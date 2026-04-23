'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Transaction {
  id: string
  asset: string
  ticker: string
  emoji: string
  amount: number
  created_at: string
}

interface Portfolio {
  balance: number
  invested: number
}

interface GroupedAsset {
  ticker: string
  asset: string
  emoji: string
  totalInvested: number
  count: number
  avgCost: number
}

function groupTransactions(transactions: Transaction[]): GroupedAsset[] {
  const map: Record<string, GroupedAsset> = {}
  for (const tx of transactions) {
    if (!map[tx.ticker]) {
      map[tx.ticker] = { ticker: tx.ticker, asset: tx.asset, emoji: tx.emoji, totalInvested: 0, count: 0, avgCost: 0 }
    }
    map[tx.ticker].totalInvested += tx.amount
    map[tx.ticker].count += 1
  }
  for (const key in map) {
    map[key].avgCost = map[key].totalInvested / map[key].count
  }
  return Object.values(map).sort((a, b) => b.totalInvested - a.totalInvested)
}

export default function PortfolioPage() {
  const router = useRouter()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selling, setSelling] = useState<string | null>(null)
  const [sellAmount, setSellAmount] = useState<Record<string, number>>({})

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
    if (!p) { router.push('/onboarding'); return }
    const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setPortfolio({ balance: p.balance, invested: p.invested })
    setTransactions(txs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [router])

  const handleSell = async (asset: GroupedAsset) => {
    const amount = sellAmount[asset.ticker] || 0
    if (amount <= 0 || amount > asset.totalInvested) return
    setSelling(asset.ticker)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
      await supabase.from('transactions').insert({ user_id: user.id, asset: asset.asset, ticker: asset.ticker, emoji: asset.emoji, amount: -amount })
      await supabase.from('portfolios').update({ balance: p.balance + amount, invested: p.invested - amount }).eq('user_id', user.id)
      await load()
      setSelling(null)
      setSellAmount(prev => ({ ...prev, [asset.ticker]: 0 }))
    } catch (e) {
      console.error(e)
      setSelling(null)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <p className="text-zinc-400">Loading your portfolio...</p>
    </main>
  )

  if (!portfolio) return null

  const totalValue = portfolio.balance + portfolio.invested
  const grouped = groupTransactions(transactions.filter(tx => tx.amount > 0))

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-emerald-400 text-2xl font-bold tracking-tight">Firs<span className="text-white">Trade</span></span>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-white text-sm transition">Search</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }} className="text-zinc-500 hover:text-white text-sm transition">Sign out</button>
        </div>
      </header>
      <div className="max-w-sm mx-auto px-6 pt-8 pb-12">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 text-center">
          <div className="text-zinc-400 text-sm mb-1">Total portfolio value</div>
          <div className="text-4xl font-bold text-white">\${totalValue.toLocaleString('en-US')}</div>
          <div className="text-zinc-500 text-xs mt-1">Started with \$10,000</div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Cash available</div>
            <div className="text-xl font-bold text-emerald-400">\${portfolio.balance.toLocaleString('en-US')}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Invested</div>
            <div className="text-xl font-bold text-white">\${portfolio.invested.toLocaleString('en-US')}</div>
          </div>
        </div>
        <div className="mb-4">
          <div className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Your investments</div>
          {grouped.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-8">No investments yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.map(asset => (
                <div key={asset.ticker} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{asset.emoji}</span>
                      <div>
                        <div className="font-semibold text-white">{asset.asset}</div>
                        <div className="text-zinc-500 text-xs">{asset.ticker}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">\${asset.totalInvested.toLocaleString('en-US')}</div>
                      <div className="text-zinc-500 text-xs">{asset.count} purchase{asset.count > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className="border-t border-zinc-800 pt-3 mb-3 flex justify-between text-xs">
                    <span className="text-zinc-400">Avg. purchase size</span>
                    <span className="text-zinc-300 font-medium">\${asset.avgCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input type="number" placeholder="Amount to sell"
                      value={sellAmount[asset.ticker] || ''}
                      onChange={e => setSellAmount(prev => ({ ...prev, [asset.ticker]: Number(e.target.value) }))}
                      max={asset.totalInvested}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-400 transition" />
                    <button onClick={() => handleSell(asset)}
                      disabled={selling === asset.ticker || !sellAmount[asset.ticker] || sellAmount[asset.ticker] <= 0 || sellAmount[asset.ticker] > asset.totalInvested}
                      className="bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-xl text-sm transition">
                      {selling === asset.ticker ? '...' : 'Sell'}
                    </button>
                  </div>
                  {sellAmount[asset.ticker] > asset.totalInvested && (
                    <p className="text-red-400 text-xs mt-1">Max you can sell: \${asset.totalInvested}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => router.push('/')} className="w-full border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-zinc-950 font-bold text-lg py-4 rounded-2xl transition-all duration-200">
          Buy more assets
        </button>
      </div>
    </main>
  )
}