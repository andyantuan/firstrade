'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handle = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Account created! Check your email to confirm, then log in.')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        // Check if user already has a portfolio
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: portfolio } = await supabase
          .from('portfolios')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (portfolio) {
          // Returning user — go straight to portfolio
          router.push('/portfolio')
        } else {
          // New user — go through onboarding
          router.push('/onboarding')
        }
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-emerald-400 text-3xl font-bold">Firs<span className="text-white">Trade</span></span>
          <p className="text-zinc-400 text-sm mt-2">Your first trade, without the risk.</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {/* Toggle */}
          <div className="flex gap-2 mb-6 bg-zinc-800 rounded-xl p-1">
            {(['signup', 'login'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m ? 'bg-emerald-400 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}>
                {m === 'signup' ? 'Create account' : 'Log in'}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3 mb-4">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition"
            />
          </div>

          {/* Error / Message */}
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          {message && <p className="text-emerald-400 text-sm mb-4">{message}</p>}

          {/* Submit */}
          <button onClick={handle} disabled={loading || !email || !password}
            className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-zinc-950 font-bold py-3 rounded-xl transition">
            {loading ? '...' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </div>
      </div>
    </main>
  )
}