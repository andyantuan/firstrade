'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

function BuyContent() {
  const router = useRouter()
  const params = useSearchParams()
  const ticker = params.get('ticker') || ''
  const [stock, setStock] = useState<StockData | null>(null)
  const [balance, setBalance] = useState(0)
  const [amount, setAmount] = useState(100)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data: p } = await supabase.from('portfolios').select('balance').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setBalance(p.balance)
      const res = await fetch('/api/stock?ticker=' + ticker)
      const data = await res.json()
      if (res.ok) setStock(data)
      setLoading(false)
    }
    init()
  }, [ticker, router])

  const buy = async () => {
    if (!stock || amount <= 0 || amount > balance) return
    setBuying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
      const entryPrice = stock.price || 0
      await supabase.from('transactions').insert({
        user_id: user.id,
        asset: stock.name,
        ticker: stock.symbol,
        emoji: '📈',
        amount,
        entry_price: entryPrice,
      })
      await supabase.from('portfolios').update({
        balance: p.balance - amount,
        invested: p.invested + amount,
      }).eq('user_id', user.id)
      setDone(true)
    } catch(e) {
      setError('Something went wrong')
    } finally {
      setBuying(false)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <p className="text-zinc-400">Loading...</p>
    </main>
  )

  if (done) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="text-center w-full max-w-sm">
        <div className="text-7xl mb-6">✅</div>
        <h1 className="text-3xl font-bold mb-2">Investment made!</h1>
        <p className="text-zinc-400 mb-8">You invested <span className="text-emerald-400 font-bold">\${amount}</span> in {stock?.name}</p>
        <button onClick={() => router.push('/portfolio')} className="w-full bg-emerald-400 text-zinc-950 font-bold py-4 rounded-2xl mb-3">View portfolio</button>
        <button onClick={() => router.push('/')} className="w-full border-2 border-zinc-700 text-zinc-400 py-4 rounded-2xl">Search more</button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-zinc-400 text-sm">← Back</button>
        <span className="text-emerald-400 font-bold">FirsTrade</span>
        <button onClick={() => router.push('/portfolio')} className="text-zinc-400 text-sm">Portfolio</button>
      </header>
      <div className="max-w-sm mx-auto px-6 pt-8">
        {stock && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-zinc-400 text-sm">{stock.symbol}</div>
                <div className="text-xl font-bold">{stock.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">\${stock.price?.toFixed(2)}</div>
                <div className={stock.change >= 0 ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>
                  {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="text-center mb-6">
          <p className="text-zinc-400 text-sm">Available cash</p>
          <p className="text-2xl font-bold text-emerald-400">\${balance.toLocaleString('en-US')}</p>
        </div>
        <h2 className="text-lg font-semibold mb-3">How much to invest?</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[50, 100, 250, 500].map(amt => (
            <button key={amt} onClick={() => setAmount(amt)}
              className={`p-4 rounded-2xl border-2 font-semibold text-lg transition-all \${amount === amt ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-white hover:border-emerald-400'}`}>
              \${amt}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        {amount > balance && <p className="text-red-400 text-sm mb-4">Amount exceeds balance</p>}
        <button onClick={buy} disabled={buying || amount > balance || !stock}
          className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-zinc-950 font-bold py-4 rounded-2xl transition mb-3">
          {buying ? 'Processing...' : `Buy \$\${amount} of \${stock?.symbol || '...'}`}
        </button>
        <p className="text-zinc-500 text-xs text-center pb-8">Paper trading only. No real money involved.</p>
      </div>
    </main>
  )
}

export default function BuyPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><p className="text-zinc-400">Loading...</p></main>}>
      <BuyContent />
    </Suspense>
  )
}