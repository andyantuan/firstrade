'use client'
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts'

interface PricePoint { date: string; price: number }

interface GroupedAsset {
  ticker: string
  asset: string
  emoji: string
  totalInvested: number
  totalShares: number
  avgEntryPrice: number
  currentPrice: number
  currentValue: number
  pnl: number
  pnlPercent: number
}

interface Props {
  asset: GroupedAsset
  onClose: () => void
}

const RANGES = ['1W', '1M', '3M', '1Y'] as const
type Range = typeof RANGES[number]

export default function StockChartModal({ asset, onClose }: Props) {
  const [range, setRange] = useState<Range>('1Y')
  const [history, setHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/stock-history?ticker=${asset.ticker}&range=${range}`)
      .then(r => r.json())
      .then(d => { setHistory(d.prices || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [asset.ticker, range])

  const isUp = asset.pnl >= 0
  const color = isUp ? '#34d399' : '#f87171'

  const formatDate = (date: string) => {
    const d = new Date(date + 'T12:00:00')
    if (range === '1W') return d.toLocaleDateString('en-US', { weekday: 'short' })
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const tickInterval = range === '1W' ? 1 : Math.floor(history.length / 4)

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl border-t border-zinc-800 px-6 pt-5 pb-10"
        style={{ maxWidth: '24rem', margin: '0 auto' }}>

        <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{asset.emoji}</span>
            <div>
              <div className="font-bold text-white text-base leading-tight">{asset.asset}</div>
              <div className="text-zinc-500 text-xs">{asset.ticker}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white text-lg">${asset.currentPrice.toFixed(2)}</div>
            <div className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '▲' : '▼'} {Math.abs(asset.pnlPercent).toFixed(2)}% your return
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-44 mb-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">Loading chart...</div>
          ) : history.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={formatDate}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  interval={tickInterval} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Price']}
                  labelFormatter={label => new Date(label + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                />
                <ReferenceLine y={asset.avgEntryPrice} stroke="#facc15"
                  strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: `Avg entry $${asset.avgEntryPrice.toFixed(0)}`, fill: '#facc15', fontSize: 9, position: 'insideTopRight' }} />
                <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2}
                  fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: color }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Range buttons */}
        <div className="flex gap-2 justify-center mb-5">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition ${
                range === r ? 'bg-emerald-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}>
              {r}
            </button>
          ))}
        </div>

        {/* P&L summary */}
        <div className="grid grid-cols-3 gap-3 bg-zinc-800/60 rounded-2xl p-4 text-xs">
          <div className="text-center">
            <div className="text-zinc-500 mb-1">Invested</div>
            <div className="text-zinc-200 font-semibold">${asset.totalInvested.toLocaleString('en-US')}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 mb-1">Now worth</div>
            <div className="text-zinc-200 font-semibold">${asset.currentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-500 mb-1">P&L</div>
            <div className={`font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {isUp ? '+' : ''}${asset.pnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}