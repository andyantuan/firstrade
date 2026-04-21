'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Screen = 'welcome' | 'intent' | 'balance' | 'mission' | 'asset' | 'amount' | 'confirm' | 'success' | 'education'
type Intent = 'learn' | 'grow' | 'explore'

interface Asset {
  id: string
  name: string
  ticker: string
  description: string
  emoji: string
}

const ASSETS: Asset[] = [
  { id: 'sp500', name: 'S&P 500', ticker: 'SPY', emoji: '🇺🇸', description: 'The 500 biggest US companies in one investment. The classic choice.' },
  { id: 'apple', name: 'Apple', ticker: 'AAPL', emoji: '🍎', description: 'iPhones, Macs, and services. One of the most valuable companies ever.' },
  { id: 'tesla', name: 'Tesla', ticker: 'TSLA', emoji: '⚡', description: 'Electric cars and clean energy. High risk, high reward.' },
  { id: 'bitcoin', name: 'Bitcoin ETF', ticker: 'IBIT', emoji: '₿', description: 'Bitcoin exposure without owning crypto directly. Volatile but exciting.' },
]

const QUICK_AMOUNTS = [50, 100, 250, 500]

export default function Onboarding() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [intent, setIntent] = useState<Intent | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [amount, setAmount] = useState<number>(100)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [showCustom, setShowCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState(10000)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      // Load real balance from Supabase
      const { data: p } = await supabase.from('portfolios').select('balance').eq('user_id', user.id).single()
      if (p) setBalance(p.balance)
    })
  }, [router])

  const next = (to: Screen) => setScreen(to)

  const confirmPurchase = async () => {
    if (!selectedAsset) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data: existing } = await supabase.from('portfolios').select('*').eq('user_id', user.id).single()
      if (!existing) {
        await supabase.from('portfolios').insert({ user_id: user.id, balance: 10000, invested: 0 })
      }
      await supabase.from('transactions').insert({
        user_id: user.id, asset: selectedAsset.name, ticker: selectedAsset.ticker, emoji: selectedAsset.emoji, amount: amount,
      })
      await supabase.from('portfolios').update({
        balance: (existing?.balance ?? 10000) - amount,
        invested: (existing?.invested ?? 0) + amount,
      }).eq('user_id', user.id)
      setBalance(prev => prev - amount)
      next('success')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (screen === 'welcome') return (
    <Screen><BigEmoji>🌱</BigEmoji><Title>Learn investing<br />by doing</Title><Subtitle>No risk. Just real experience.</Subtitle><Spacer /><PrimaryButton onClick={() => next('intent')}>Start</PrimaryButton></Screen>
  )

  if (screen === 'intent') return (
    <Screen>
      <Title>What do you want to do?</Title><Spacer small />
      <div className="flex flex-col gap-3 w-full">
        {[
          { id: 'learn', label: '📚 Learn investing', sub: 'Understand how markets work' },
          { id: 'grow', label: '📈 Grow money', sub: "Even if it's fake for now" },
          { id: 'explore', label: '🔍 Just explore', sub: 'No pressure, just looking' },
        ].map(option => (
          <button key={option.id} onClick={() => { setIntent(option.id as Intent); next('balance') }}
            className="w-full text-left p-4 rounded-2xl border-2 border-zinc-800 hover:border-emerald-400 bg-zinc-900 transition-all duration-200">
            <div className="font-semibold text-white text-lg">{option.label}</div>
            <div className="text-zinc-400 text-sm mt-1">{option.sub}</div>
          </button>
        ))}
      </div>
    </Screen>
  )

  if (screen === 'balance') return (
    <Screen><BigEmoji>💰</BigEmoji><Title>You now have<br /><span className="text-emerald-400">$10,000</span><br />to invest</Title><Subtitle>Use it to learn. No real risk.</Subtitle><Spacer /><PrimaryButton onClick={() => next('mission')}>Let's invest</PrimaryButton></Screen>
  )

  if (screen === 'mission') return (
    <Screen>
      <div className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">Your first mission</div>
      <Title>Invest your<br />first $100</Title><Subtitle>Pick something you believe in.</Subtitle><Spacer />
      <PrimaryButton onClick={() => next('asset')}>Start</PrimaryButton>
    </Screen>
  )

  if (screen === 'asset') return (
    <Screen>
      <Title>What do you want<br />to invest in?</Title><Spacer small />
      <div className="flex flex-col gap-3 w-full">
        {ASSETS.map(asset => (
          <button key={asset.id} onClick={() => { setSelectedAsset(asset); next('amount') }}
            className="w-full text-left p-4 rounded-2xl border-2 border-zinc-800 hover:border-emerald-400 bg-zinc-900 transition-all duration-200">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{asset.emoji}</span>
              <div>
                <div className="font-semibold text-white">{asset.name}<span className="text-zinc-500 text-sm font-normal ml-2">{asset.ticker}</span></div>
                <div className="text-zinc-400 text-sm mt-0.5">{asset.description}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Screen>
  )

  if (screen === 'amount') return (
    <Screen>
      <Title>How much do you<br />want to invest?</Title>
      <div className="text-zinc-400 text-sm mb-6">Balance: <span className="text-emerald-400 font-semibold">${balance.toLocaleString()}</span></div>
      <div className="grid grid-cols-2 gap-3 w-full mb-4">
        {QUICK_AMOUNTS.map(amt => (
          <button key={amt} onClick={() => { setAmount(amt); setShowCustom(false) }}
            className={`p-4 rounded-2xl border-2 font-semibold text-lg transition-all duration-200 ${amount === amt && !showCustom ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-white hover:border-emerald-400'}`}>
            ${amt}
          </button>
        ))}
      </div>
      {!showCustom ? (
        <button onClick={() => setShowCustom(true)} className="text-zinc-400 hover:text-emerald-400 text-sm transition-colors mb-6">Enter custom amount</button>
      ) : (
        <div className="w-full mb-6">
          <input type="number" placeholder="Enter amount" value={customAmount}
            onChange={e => { setCustomAmount(e.target.value); setAmount(Number(e.target.value)) }}
            className="w-full bg-zinc-900 border-2 border-emerald-400 rounded-xl px-4 py-3 text-white text-center text-xl focus:outline-none" />
        </div>
      )}
      {amount > balance && <p className="text-red-400 text-sm mb-4">Amount exceeds your balance</p>}
      <PrimaryButton onClick={() => next('confirm')} disabled={amount <= 0 || amount > balance}>Continue</PrimaryButton>
    </Screen>
  )

  if (screen === 'confirm') return (
    <Screen>
      <BigEmoji>{selectedAsset?.emoji}</BigEmoji>
      <Title>Buy <span className="text-emerald-400">${amount}</span><br />of {selectedAsset?.name}</Title>
      <Subtitle>Remaining balance: <span className="text-white font-semibold">${(balance - amount).toLocaleString()}</span></Subtitle>
      <Spacer />
      <PrimaryButton onClick={confirmPurchase} disabled={loading}>{loading ? 'Investing...' : 'Confirm investment'}</PrimaryButton>
      <button onClick={() => next('amount')} className="mt-3 text-zinc-500 hover:text-white text-sm transition-colors">Go back</button>
    </Screen>
  )

  if (screen === 'success') return (
    <Screen>
      <BigEmoji>✅</BigEmoji>
      <Title>You just made your<br />first investment</Title>
      <Subtitle>Now let's see how it performs.</Subtitle>
      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 my-6 text-left">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2"><span className="text-2xl">{selectedAsset?.emoji}</span><span className="font-semibold text-white">{selectedAsset?.name}</span></div>
          <span className="text-emerald-400 font-bold text-lg">${amount}</span>
        </div>
        <div className="border-t border-zinc-800 mt-3 pt-3 flex justify-between text-sm">
          <span className="text-zinc-400">Remaining balance</span>
          <span className="text-white font-semibold">${balance.toLocaleString()}</span>
        </div>
      </div>
      <PrimaryButton onClick={() => next('education')}>Continue</PrimaryButton>
    </Screen>
  )

  if (screen === 'education') return (
    <Screen>
      <BigEmoji>📊</BigEmoji>
      <Title>Your money will go<br />up and down every day</Title>
      <Subtitle>That's normal.<br />That's investing.</Subtitle>
      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 my-6 text-left">
        <p className="text-zinc-400 text-sm leading-relaxed">Even the best investors see their portfolio drop sometimes. What matters is staying calm and thinking long term. You're already ahead — you started.</p>
      </div>
      <PrimaryButton onClick={() => router.push('/portfolio')}>Go to my portfolio</PrimaryButton>
    </Screen>
  )

  return null
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-12"><div className="w-full max-w-sm flex flex-col items-center text-center">{children}</div></main>
}
function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-4xl font-bold leading-tight mb-3">{children}</h1>
}
function Subtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-zinc-400 text-lg leading-relaxed">{children}</p>
}
function BigEmoji({ children }: { children: React.ReactNode }) {
  return <div className="text-7xl mb-6">{children}</div>
}
function Spacer({ small }: { small?: boolean }) {
  return <div className={small ? 'h-4' : 'h-8'} />
}
function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold text-lg py-4 rounded-2xl transition-all duration-200">{children}</button>
}
