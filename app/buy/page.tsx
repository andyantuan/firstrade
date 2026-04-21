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
  currency: string
}

const QUICK_AMOUNTS = [50, 100, 250, 500]

function BuyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ticker = searchParams.get('ticker') || ''

  const [stock, setStock] = useState<StockData | null>(null)
  const [balance, setBalance] = useState(0)
  const [amount, setAmount] = useState(100)
  const [customAmount, setCustomAmount] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const init = async () => {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Load balance
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (!portfolio) { router.push('/onboarding'); return }
      setBalance(portfolio.balance)

      // Load stock price
      if (ticker) {
        const res = await fetch(`/api/stock?ticker=${ticker}`)
        const data = await res.json()
        if (res.ok) setStock(data)
        else setError('Stock not found')
      }

      setLoading(false)
    }
    init()
  }, [ticker, router])

  const handleBuy = async () => {
    if (!stock || amount <= 0 || amount > balance) return
    setBuying(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }

      // Get current portfolio
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user.id)
        .single()

      // Save transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        asset: stock.name,
        ticker: stock.symbol,
        emoji: '📈',
        amount: amount,
      })

      // Update balance
      await supabase.from('portfolios').update({
        balance: portfolio.balance - amount,
        invested: portfolio.invested + amount,
      }).eq('user_id', user.id)

      setSuccess(true)
    } catch (e) {
      setError('Something went wrong. Try again.')
      console.error(e)
    } finally {
      setBuying(false)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <p className="text-zinc-400">Loading...</p>
    </main>
  )

  if (success) return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="text-7xl mb-6">✅</div>
        <h1 className="text-4xl font-bold mb-3">Investment made!</h1>
        <p className="text-zinc-400 mb-8">You invested <span className="text-emerald-400 font-bold">${amount}</span> in {stock?.name}</p>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Remaining balance</span>
            <span className="text-white font-semibold">${(balance - amount).toLocaleString('en-US')}</span>
          </div>
        </div>
        <button onClick={() => router.push('/portfolio')}
          className="w-full bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold py-4 rounded-2xl transition mb-3">
          View my portfolio
        </button>
        <button onClick={() => router.push('/')}
          className="w-full border-2 border-zinc-700 text-zinc-400 hover:text-white font-semibold py-4 rounded-2xl transition">
          Search more stocks
        </button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-white transition text-sm">
          ← Back
        </button>
        <span className="text-emerald-400 font-bold text-lg">Firs<span className="text-white">Trade</span></span>
        <button onClick={() => router.push('/portfolio')} className="text-zinc-400 hover:text-white transition text-sm">
          Portfolio
        </button>
      </header>

      <div className="max-w-sm mx-auto px-6 pt-8">
        {/* Stock info */}
        {stock && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-zinc-400 text-sm">{stock.symbol}</div>
                <div className="text-xl font-bold text-white">{stock.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${stock.price?.toFixed(2)}</div>
                <div className={`text-sm font-medium ${stock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Balance */}
        <div className="text-center mb-6">
          <p className="text-zinc-400 text-sm">Available cash</p>
          <p className="text-2xl font-bold text-emerald-400">${balance.toLocaleString('en-US')}</p>
        </div>

        {/* Amount selection */}
        <h2 className="text-lg font-semibold mb-3">How much to invest?</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {QUICK_AMOUNTS.map(amt => (
            <button key={amt} onClick={() => { setAmount(amt); setShowCustom(false) }}
              className={`p-4 rounded-2xl border-2 font-semibold text-lg transition-all ${
                amount === amt && !showCustom
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-900 text-white hover:border-emerald-400'}`}>
              ${amt}
            </button>
          ))}
        </div>

        {!showCustom ? (
          <button onClick={() => setShowCustom(true)}
            className="text-zinc-400 hover:text-emerald-400 text-sm transition-colors mb-6 w-full text-center">
            Enter custom amount
          </button>
        ) : (
          <div className="mb-6">
            <input type="number" placeholder="Enter amount" value={customAmount}
              onChange={e => { setCustomAmount(e.target.value); setAmount(Number(e.target.value)) }}
              className="w-full bg-zinc-900 border-2 border-emerald-400 rounded-xl px-4 py-3 text-white text-center text-xl focus:outline-none" />
          </div>
        )}

        {/* Errors */}
        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
        {amount > balance && <p className="text-red-400 text-sm mb-4 text-center">Amount exceeds your balance</p>}

        {/* Confirm */}
        <button onClick={handleBuy}
          disabled={buying || amount <= 0 || amount > balance || !stock}
          className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold text-lg py-4 rounded-2xl transition mb-3">
          {buying ? 'Processing...' : `Buy $${amount} of ${stock?.symbol || '...'}`}
        </button>

        <p className="text-zinc-500 text-xs text-center pb-8">
          This is a paper trading simulation. No real money is involved.
        </p>
      </div>
    </main>
  )
}

export default function BuyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </main>
    }>
      <BuyPageContent />
    </Suspense>
  )
}