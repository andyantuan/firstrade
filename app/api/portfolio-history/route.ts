import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getDates(days: number): string[] {
  const dates: string[] = []
  const today = new Date()
  const step = Math.floor(days / 30)
  for (let i = days; i >= 0; i -= step) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

async function getHistoricalPrice(ticker: string, date: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${Math.floor(new Date(date).getTime() / 1000) - 86400}&period2=${Math.floor(new Date(date).getTime() / 1000) + 86400}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await res.json()
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []
    const validClose = closes.filter((c: number) => c != null).pop()
    return validClose || 0
  } catch {
    return 0
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  try {
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!txs || txs.length === 0) return NextResponse.json({ points: [] })

    const { data: portfolio } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .single()

    const dates = getDates(365)
    const tickers = [...new Set(txs.map(t => t.ticker))]

    // Fetch all historical prices in parallel per ticker
    const priceCache: Record<string, Record<string, number>> = {}
    await Promise.all(tickers.map(async ticker => {
      priceCache[ticker] = {}
      await Promise.all(dates.map(async date => {
        priceCache[ticker][date] = await getHistoricalPrice(ticker, date)
      }))
    }))

    const points = dates.map(date => {
      // Get all buy transactions up to this date
      const txsUpToDate = txs.filter(tx => tx.created_at.split('T')[0] <= date)

      // Group into positions
      const positions: Record<string, { shares: number, invested: number }> = {}
      for (const tx of txsUpToDate) {
        if (!positions[tx.ticker]) positions[tx.ticker] = { shares: 0, invested: 0 }
        const shares = tx.entry_price > 0 ? tx.amount / tx.entry_price : 0
        positions[tx.ticker].shares += shares
        positions[tx.ticker].invested += tx.amount
      }

      // Calculate market value at this date
      let marketValue = 0
      for (const [ticker, pos] of Object.entries(positions)) {
        if (pos.shares > 0) {
          const price = priceCache[ticker]?.[date] || 0
          marketValue += pos.shares * price
        }
      }

      // Cash = starting balance minus total invested up to this date
      const totalInvestedToDate = txsUpToDate
        .filter(tx => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0)
      const totalSoldToDate = txsUpToDate
        .filter(tx => tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
      const cash = (portfolio?.balance || 10000) + totalSoldToDate - (txsUpToDate.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0))

      return {
        date,
        value: Math.round((marketValue + (10000 - totalInvestedToDate + totalSoldToDate)) * 100) / 100
      }
    })

    return NextResponse.json({ points })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to calculate history' }, { status: 500 })
  }
}