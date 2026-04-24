'use client'
import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts'

interface Point { date: string; value: number }

interface Props { userId: string }

export default function PortfolioChart({ userId }: Props) {
  const [points, setPoints] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/portfolio-history?user_id=${userId}`)
      .then(r => r.json())
      .then(d => { setPoints(d.points || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [userId])

  if (loading) return (
    <div className="h-36 flex items-center justify-center text-zinc-500 text-sm">
      Loading performance...
    </div>
  )

  if (points.length === 0) return null

  const isUp = points[points.length - 1]?.value >= 10000
  const color = isUp ? '#34d399' : '#f87171'

  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date"
            tickFormatter={d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
            tick={{ fontSize: 10, fill: '#71717a' }}
            interval={Math.floor(points.length / 4)}
            axisLine={false} tickLine={false} />
          <YAxis domain={['auto', 'auto']}
            tick={{ fontSize: 10, fill: '#71717a' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            formatter={(v) => [`$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`, 'Portfolio value']}
            labelFormatter={l => new Date(l + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          />
          <ReferenceLine y={10000} stroke="#facc15" strokeDasharray="4 4" strokeWidth={1.5}
            label={{ value: 'Started $10k', fill: '#facc15', fontSize: 9, position: 'insideTopRight' }} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2}
            fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 4, fill: color }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}