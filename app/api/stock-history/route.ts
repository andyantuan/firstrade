import { NextRequest, NextResponse } from 'next/server'

const RANGE_MAP: Record<string, string> = {
  '1W': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '1Y': '1y',
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  const range = request.nextUrl.searchParams.get('range') || '1Y'
  if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

  try {
    const yahooRange = RANGE_MAP[range] || '1y'
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=${yahooRange}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await res.json()

    const result = data?.chart?.result?.[0]
    if (!result) throw new Error('Not found')

    const timestamps: number[] = result.timestamp || []
    const closes: number[] = result.indicators?.quote?.[0]?.close || []

    const prices = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        price: closes[i] != null ? Math.round(closes[i] * 100) / 100 : null,
      }))
      .filter(p => p.price !== null)

    return NextResponse.json({ ticker: ticker.toUpperCase(), prices })
  } catch {
    return NextResponse.json({ error: 'History not found' }, { status: 404 })
  }
}