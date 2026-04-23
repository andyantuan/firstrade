'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import StockChartModal from '@/components/StockChartModal'

interface Transaction {
  id: string
  asset: string
  ticker: string
  emoji: string
  amount: number
  entry_price: number
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
  totalShares: number
  avgEntryPrice: number
  count: number
  currentPrice: number
  currentValue: number
  pnl: number
  pnlPercent: number
}

interface LivePrices {
  [ticker: string]: number
}

async function fetchLivePrice(ticker: string): Promise<number> {
  try {
    const res = await fetch('/api/stock?ticker=' + ticker)
    const data = await res.json()
    return data.price || 0
  } catch {
    return 0
  }
}

function groupTransactions(transactions: Transaction[], prices: LivePrices): GroupedAsset[] {
  const map: Record<string, {
    ticker: string, asset: string, emoji: string,
    totalInvested: number, totalShares: number, count: number, entryPriceSum: number
  }> = {}

  for (const tx of transactions) {
    if (tx.amount <= 0) continue
    if (!map[tx.ticker]) {
      map[tx.ticker] = { ticker: tx.ticker, asset: tx.asset, emoji: tx.emoji, totalInvested: 0, totalShares: 0, count: 0, entryPriceSum: 0 }
    }
    const shares = tx.entry_price > 0 ? tx.amount / tx.entry_price : 0
    map[tx.ticker].totalInvested += tx.amount
    map[tx.ticker].totalShares += shares
    map[tx.ticker].count += 1
    map[tx.ticker].entryPriceSum += tx.entry_price
  }

  return Object.values(map).map(g => {
    const currentPrice = prices[g.ticker] || 0
    const currentValue = g.totalShares * currentPrice
    const pnl = currentValue - g.totalInvested
    const pnlPercent = g.totalInvested > 0 ? (pnl / g.totalInvested) * 100 : 0
    const avgEntryPrice = g.count > 0 ? g.entryPriceSum / g.count : 0
    return { ...g, avgEntryPrice, currentPrice, currentValue, pnl, pnlPercent }
  }).sort((a, b) => b.totalInvested - a.totalInvested)
}

export default function PortfolioPage() {
  const router = useRouter()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prices, setPrices] = useState<LivePrices>({})
  const [loading, setLoading] = useState(true)
  const [selling, setSelling] = useState<string | null>(null)
  const [sellAmount, setSellAmount] = useState<Record<string, number>>({})
  const [selectedAsset, setSelectedAsset] = useState<GroupedAsset | null>(null)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
    if (!p) { router.push('/onboarding'); return }
    const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setPortfolio({ balance: p.balance, invested: p.invested })
    const allTxs = txs || []
    setTransactions(allTxs)

    const tickers = [...new Set(allTxs.filter(t => t.amount > 0).map(t => t.ticker))]
    const priceMap: LivePrices = {}
    await Promise.all(tickers.map(async ticker => {
      priceMap[ticker] = await fetchLivePrice(ticker)
    }))
    setPrices(priceMap)
    setLoading(false)
  }

  useEffect(() => { load() }, [router])

  const handleSell = async (asset: GroupedAsset, sellAll = false) => {
    const amount = sellAll ? asset.totalInvested : (sellAmount[asset.ticker] || 0)
    if (amount <= 0 || amount > asset.totalInvested) return
    setSelling(asset.ticker)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()

      const sharesToSell = asset.totalShares * (amount / asset.totalInvested)
      const saleValue = sellAll ? asset.currentValue : sharesToSell * asset.currentPrice

      await supabase.from('transactions').insert({
        user_id: user.id, asset: asset.asset, ticker: asset.ticker,
        emoji: asset.emoji, amount: -amount, entry_price: asset.currentPrice,
      })
      await supabase.from('portfolios').update({
        balance: p.balance + saleValue,
        invested: p.invested - amount,
      }).eq('user_id', user.id)

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
      <p className="text-zinc-400">Loading portfolio...</p>
    </main>
  )

  if (!portfolio) return null

  const grouped = groupTransactions(transactions, prices)
  const totalCurrentValue = grouped.reduce((sum, a) => sum + a.currentValue, 0)
  const totalInvested = grouped.reduce((sum, a) => sum + a.totalInvested, 0)
  const totalPnL = totalCurrentValue - totalInvested
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
  const totalPortfolioValue = portfolio.balance + totalCurrentValue

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
        {/* Total portfolio value */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 text-center">
          <div className="text-zinc-400 text-sm mb-1">Total portfolio value</div>
          <div className="text-4xl font-bold text-white">${totalPortfolioValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          <div className="text-zinc-500 text-xs mt-1">Started with $10,000</div>
          {totalInvested > 0 && (
            <div className={`text-sm font-semibold mt-2 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPnL >= 0 ? '▲' : '▼'} ${Math.abs(totalPnL).toLocaleString('en-US', { maximumFractionDigits: 2 })} ({Math.abs(totalPnLPercent).toFixed(2)}%) total return
            </div>
          )}
        </div>

        {/* Balance + Invested */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Cash available</div>
            <div className="text-xl font-bold text-emerald-400">${portfolio.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Market value</div>
            <div className="text-xl font-bold text-white">${totalCurrentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Assets */}
        <div className="mb-4">
          <div className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Your investments</div>
          {grouped.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-8">No investments yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {grouped.map(asset => (
                <div
                  key={asset.ticker}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => setSelectedAsset(asset)}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{asset.emoji}</span>
                      <div>
                        <div className="font-semibold text-white">{asset.asset}</div>
                        <div className="text-zinc-500 text-xs">{asset.ticker}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white">${asset.currentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                      <div className={`text-xs font-medium ${asset.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {asset.pnl >= 0 ? '▲' : '▼'} ${Math.abs(asset.pnl).toFixed(2)} ({Math.abs(asset.pnlPercent).toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 mb-3 text-xs">
                    <div>
                      <div className="text-zinc-500 mb-1">Invested</div>
                      <div className="text-zinc-300">${asset.totalInvested.toLocaleString('en-US')}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Avg entry</div>
                      <div className="text-zinc-300">${asset.avgEntryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Current</div>
                      <div className="text-zinc-300">${asset.currentPrice.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Sell — stop click from opening chart */}
                  <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <input type="number" placeholder="Amount $"
                      value={sellAmount[asset.ticker] || ''}
                      onChange={e => setSellAmount(prev => ({ ...prev, [asset.ticker]: Number(e.target.value) }))}
                      max={asset.totalInvested}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-400 transition" />
                    <button onClick={() => handleSell(asset)}
                      disabled={selling === asset.ticker || !sellAmount[asset.ticker] || sellAmount[asset.ticker] <= 0 || sellAmount[asset.ticker] > asset.totalInvested}
                      className="bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-semibold px-3 py-2 rounded-xl text-sm transition">
                      {selling === asset.ticker ? '...' : 'Sell'}
                    </button>
                    <button onClick={() => handleSell(asset, true)}
                      disabled={selling === asset.ticker}
                      className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white font-semibold px-3 py-2 rounded-xl text-sm transition">
                      All
                    </button>
                  </div>
                  {sellAmount[asset.ticker] > asset.totalInvested && (
                    <p className="text-red-400 text-xs mt-1">Max: ${asset.totalInvested}</p>
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

      {/* Chart modal */}
      {selectedAsset && (
        <StockChartModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </main>
  )
}