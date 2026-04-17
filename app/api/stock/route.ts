import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'Ticker required' }, { status: 400 })

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) throw new Error('Not found')

    return NextResponse.json({
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      price: meta.regularMarketPrice,
      change: meta.regularMarketPrice - meta.chartPreviousClose,
      changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
      currency: meta.currency,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
    })
  } catch {
    return NextResponse.json({ error: 'Stock not found' }, { status: 404 })
  }
}
