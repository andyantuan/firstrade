'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import StockChartModal from '@/components/StockChartModal'
import PortfolioChart from '@/components/PortfolioChart'

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
  oldestTx: string
}

interface LivePrices {
  [ticker: string]: number
}

interface Badge {
  badge_id: string
  earned_at: string
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
    totalInvested: number, totalShares: number, count: number,
    entryPriceSum: number, oldestTx: string
  }> = {}

  for (const tx of transactions) {
    if (tx.amount <= 0) continue
    if (!map[tx.ticker]) {
      map[tx.ticker] = {
        ticker: tx.ticker, asset: tx.asset, emoji: tx.emoji,
        totalInvested: 0, totalShares: 0, count: 0,
        entryPriceSum: 0, oldestTx: tx.created_at
      }
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

function getInsightSentence(grouped: GroupedAsset[]): string {
  if (grouped.length === 0) return "Make your first investment to start learning."
  const allGreen = grouped.every(a => a.pnl >= 0)
  const bigLoser = grouped.find(a => a.pnlPercent < -10)
  const onlyOne = grouped.length === 1
  const daysSinceOldest = grouped[0]?.oldestTx
    ? Math.floor((Date.now() - new Date(grouped[0].oldestTx).getTime()) / 86400000)
    : 0

  if (bigLoser) return "Markets go up and down. The investors who do best are usually the ones who wait."
  if (allGreen) return "Your portfolio is growing. The best move right now is usually to do nothing."
  if (onlyOne) return "You're off to a great start. Adding a second company would spread your risk."
  if (daysSinceOldest >= 7) return "You haven't made any changes this week. That patience is a real investing skill."
  return "Keep going. Long-term investors think in years, not days."
}

function getAssetInsight(asset: GroupedAsset): string {
  const daysSinceBuy = Math.floor(
    (Date.now() - new Date(asset.oldestTx).getTime()) / 86400000
  )
  if (asset.pnlPercent > 10) return "Strong performer. Let it ride."
  if (asset.pnlPercent < -10) return "Down this week — this is normal. Companies recover."
  if (daysSinceBuy >= 30) return "You've held this a month. That patience is what investing is."
  if (daysSinceBuy < 7) return "Still early. Give it time before judging performance."
  return "Steady. Keep watching how it behaves."
}

export default function PortfolioPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [prices, setPrices] = useState<LivePrices>({})
  const [loading, setLoading] = useState(true)
  const [selling, setSelling] = useState<string | null>(null)
  const [sellAmount, setSellAmount] = useState<Record<string, number>>({})
  const [selectedAsset, setSelectedAsset] = useState<GroupedAsset | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [newBadge, setNewBadge] = useState<string | null>(null)
  const [sellReflection, setSellReflection] = useState<{ asset: GroupedAsset, sellAll: boolean } | null>(null)

  const hasBadge = (id: string) => badges.some(b => b.badge_id === id)

  const awardBadge = async (badgeId: string, uid: string) => {
    const { error } = await supabase.from('badges').insert({ user_id: uid, badge_id: badgeId })
    if (!error) {
      setBadges(prev => [...prev, { badge_id: badgeId, earned_at: new Date().toISOString() }])
      setNewBadge(badgeId)
      setTimeout(() => setNewBadge(null), 4000)
    }
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }
    setUserId(user.id)

    const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
    if (!p) { router.push('/onboarding'); return }

    const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    const { data: userBadges } = await supabase.from('badges').select('*').eq('user_id', user.id)

    setPortfolio({ balance: p.balance, invested: p.invested })
    const allTxs = txs || []
    setTransactions(allTxs)
    setBadges(userBadges || [])

    const tickers = [...new Set(allTxs.filter(t => t.amount > 0).map(t => t.ticker))]
    const priceMap: LivePrices = {}
    await Promise.all(tickers.map(async ticker => {
      priceMap[ticker] = await fetchLivePrice(ticker)
    }))
    setPrices(priceMap)
    setLoading(false)

    // Badge 1 — First Seed
    const hasBuyTx = allTxs.some(t => t.amount > 0)
    const alreadyHasBadge1 = (userBadges || []).some(b => b.badge_id === 'first_seed')
    if (hasBuyTx && !alreadyHasBadge1) {
      await awardBadge('first_seed', user.id)
    }
  }

  useEffect(() => { load() }, [router])

  const handleSellClick = (asset: GroupedAsset, sellAll: boolean) => {
    if (!sellAll && (!sellAmount[asset.ticker] || sellAmount[asset.ticker] <= 0)) return
    setSellReflection({ asset, sellAll })
  }

  const handleSellConfirm = async (reason: string) => {
    if (!sellReflection) return
    const { asset, sellAll } = sellReflection
    const amount = sellAll ? asset.totalInvested : (sellAmount[asset.ticker] || 0)
    if (amount <= 0 || amount > asset.totalInvested) return
    setSelling(asset.ticker)
    setSellReflection(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
      const sharesToSell = asset.totalShares * (amount / asset.totalInvested)
      const saleValue = sellAll ? asset.currentValue : sharesToSell * asset.currentPrice
      await supabase.from('transactions').insert({
        user_id: user.id, asset: asset.asset, ticker: asset.ticker,
        emoji: asset.emoji, amount: -amount, entry_price: asset.currentPrice,
        sell_reason: reason,
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
  const insight = getInsightSentence(grouped)

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

        {/* Balance + Market value */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Cash available</div>
            <div className="text-xl font-bold text-emerald-400">${portfolio.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Market value</div>
            <div className="text-xl font-bold text-white">${totalCurrentValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        {/* Insight sentence */}
        {grouped.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
            <span className="text-lg mt-0.5">💡</span>
            <p className="text-zinc-300 text-sm leading-relaxed">{insight}</p>
          </div>
        )}

        {/* Performance chart — locked behind Diamond Hands badge */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
          {hasBadge('diamond_hands') && userId ? (
            <>
              <div className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Your performance</div>
              <PortfolioChart userId={userId} />
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-white font-semibold text-sm mb-1">Performance Chart</div>
              <div className="flex items-center justify-center gap-1 mb-3">
                <span className="text-zinc-500 text-xs">🔒 Unlocks with</span>
                <span className="text-yellow-400 text-xs font-semibold">💎 Diamond Hands</span>
              </div>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Hold any position through a 10% dip without selling to unlock your performance history chart.
              </p>
            </div>
          )}
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
                  <div className="flex items-center justify-between mb-2">
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
                        {asset.pnl >= 0 ? '▲' : '▼'} {Math.abs(asset.pnlPercent).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Asset insight */}
                  <p className="text-zinc-500 text-xs mb-3 pl-1">{getAssetInsight(asset)}</p>

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

                  {/* Sell */}
                  <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <input type="number" placeholder="Amount $"
                      value={sellAmount[asset.ticker] || ''}
                      onChange={e => setSellAmount(prev => ({ ...prev, [asset.ticker]: Number(e.target.value) }))}
                      max={asset.totalInvested}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-red-400 transition" />
                    <button
                      onClick={() => handleSellClick(asset, false)}
                      disabled={selling === asset.ticker || !sellAmount[asset.ticker] || sellAmount[asset.ticker] <= 0 || sellAmount[asset.ticker] > asset.totalInvested}
                      className="bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-semibold px-3 py-2 rounded-xl text-sm transition">
                      {selling === asset.ticker ? '...' : 'Sell'}
                    </button>
                    <button
                      onClick={() => handleSellClick(asset, true)}
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

      {/* Sell reflection modal */}
      {sellReflection && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSellReflection(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl border-t border-zinc-800 px-6 pt-5 pb-10" style={{ maxWidth: '24rem', margin: '0 auto' }}>
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-5" />
            <h2 className="text-white font-bold text-lg mb-1">Before you sell —</h2>
            <p className="text-zinc-400 text-sm mb-5">Why are you selling <span className="text-white font-semibold">{sellReflection.asset.asset}</span>?</p>
            <div className="flex flex-col gap-3">
              {[
                { reason: 'price_dropped', label: '📉 The price dropped and I\'m worried', nudge: 'Selling when prices drop locks in the loss. Markets usually recover.' },
                { reason: 'switching', label: '💸 I want to invest in something else', nudge: 'Switching is a valid strategy. Make sure you\'ve thought it through.' },
                { reason: 'taking_profit', label: '✅ I made a profit and I\'m happy', nudge: 'Taking profits is smart. Well done.' },
                { reason: 'just_trying', label: '🤷 I\'m just trying it out', nudge: 'That\'s completely fine — this is practice money.' },
              ].map(({ reason, label, nudge }) => (
                <button key={reason}
                  onClick={() => handleSellConfirm(reason)}
                  className="text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl p-4 transition">
                  <div className="text-white text-sm font-medium mb-1">{label}</div>
                  <div className="text-zinc-500 text-xs">{nudge}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Badge toast */}
      {newBadge && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-emerald-400/40 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-2xl">🌱</span>
          <div>
            <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Badge unlocked</div>
            <div className="text-white text-sm font-bold">First Seed</div>
          </div>
        </div>
      )}
    </main>
  )
}