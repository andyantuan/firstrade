'use client'
import { useState, useEffect } from 'react'

interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  currency: string
  high: number
  low: number
  volume: number
}

export default function Home() {
  const [ticker, setTicker] = useState('')
  const [stock, setStock] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    setStock(null)
    try {
      const res = await fetch(`/api/stock?ticker=${ticker.trim()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStock(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const isPositive = stock && stock.change >= 0

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-emerald-400 text-2xl font-bold tracking-tight">Firs<span className="text-white">Trade</span></span>
        <button
        onClick={() => {
          const p = localStorage.getItem('firstrade_portfolio')
          if (p && JSON.parse(p).transactions?.length > 0) {
            window.location.href = '/portfolio'
          } else {
            window.location.href = '/onboarding'
          }
        }}
        className="bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold px-4 py-2 rounded-xl text-sm transition">
        My Portfolio
      </button>
      </header>
      <section className="max-w-2xl mx-auto px-6 pt-24 pb-12 text-center">
        <h1 className="text-5xl font-bold mb-4 leading-tight">Your first trade,<br /><span className="text-emerald-400">without the risk.</span></h1>
        <p className="text-zinc-400 text-lg mb-12">Practice investing with $100,000 in virtual money. Learn the market before putting real money on the line.</p>
        <div className="flex gap-2">
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search a stock — try AAPL, TSLA, MSFT" className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition" />
          <button onClick={search} disabled={loading} className="bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold px-6 py-3 rounded-xl transition disabled:opacity-50">{loading ? '...' : 'Search'}</button>
        </div>
        {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}
        {stock && (
          <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-zinc-400 text-sm">{stock.symbol}</div>
                <div className="text-xl font-semibold">{stock.name}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{stock.currency === 'USD' ? '$' : ''}{stock.price?.toFixed(2)}</div>
                <div className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>{isPositive ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)} ({Math.abs(stock.changePercent).toFixed(2)}%)</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800">
              <div><div className="text-zinc-500 text-xs mb-1">Day High</div><div className="font-medium">${stock.high?.toFixed(2)}</div></div>
              <div><div className="text-zinc-500 text-xs mb-1">Day Low</div><div className="font-medium">${stock.low?.toFixed(2)}</div></div>
              <div><div className="text-zinc-500 text-xs mb-1">Volume</div><div className="font-medium">{stock.volume?.toLocaleString()}</div></div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}