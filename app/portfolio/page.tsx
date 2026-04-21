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

export default function PortfolioPage() {
  const router = useRouter()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Load portfolio
      const { data: p } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!p) {
        router.push('/onboarding')
        return
      }

      // Load transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setPortfolio({ balance: p.balance, invested: p.invested })
      setTransactions(txs || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      <p className="text-zinc-400">Loading your portfolio...</p>
    </main>
  )

  if (!portfolio) return null

  const totalValue = portfolio.balance + portfolio.invested

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-emerald-400 text-2xl font-bold tracking-tight">
          Firs<span className="text-white">Trade</span>
        </span>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }}
          className="text-zinc-500 hover:text-white text-sm transition">
          Sign out
        </button>
      </header>

      <div className="max-w-sm mx-auto px-6 pt-8 pb-12">
        {/* Total value */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 text-center">
          <div className="text-zinc-400 text-sm mb-1">Total portfolio value</div>
          <div className="text-4xl font-bold text-white">${totalValue.toLocaleString()}</div>
          <div className="text-zinc-500 text-xs mt-1">Started with $10,000</div>
        </div>

        {/* Balance + Invested */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Cash available</div>
            <div className="text-xl font-bold text-emerald-400">
              ${portfolio.balance.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-zinc-400 text-xs mb-1">Invested</div>
            <div className="text-xl font-bold text-white">
              ${portfolio.invested.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="mb-4">
          <div className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Your investments</div>
          {transactions.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-8">No investments yet</div>
          ) : (
            <div className="flex flex-col gap-3">
              {transactions.map(tx => (
                <div key={tx.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{tx.emoji}</span>
                    <div>
                      <div className="font-semibold text-white">{tx.asset}</div>
                      <div className="text-zinc-500 text-xs">{tx.ticker}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white">${tx.amount}</div>
                    <div className="text-zinc-500 text-xs">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invest more */}
        <button
          onClick={() => router.push('/')}
          className="w-full border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-zinc-950 font-bold text-lg py-4 rounded-2xl transition-all duration-200">
          Search more assets
        </button>
      </div>
    </main>
  )
}