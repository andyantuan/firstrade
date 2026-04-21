// lib/storage.ts
// Data layer — all reads/writes go through here.
// Now connected to Supabase instead of localStorage.

import { supabase } from './supabase'

export interface Portfolio {
  id: string
  userId: string
  balance: number
  invested: number
  transactions: Transaction[]
}

export interface Transaction {
  id: string
  asset: string
  ticker: string
  emoji: string
  amount: number
  timestamp: string
}

const STARTING_BALANCE = 10000

// Create a fresh portfolio for a new user in Supabase
export async function createPortfolio(userId: string): Promise<Portfolio> {
  const { data, error } = await supabase
    .from('portfolios')
    .insert({ user_id: userId, balance: STARTING_BALANCE, invested: 0 })
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id,
    userId: data.user_id,
    balance: data.balance,
    invested: data.invested,
    transactions: [],
  }
}

// Get portfolio + transactions for current user
export async function getPortfolio(): Promise<Portfolio | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!portfolio) return null

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return {
    id: portfolio.id,
    userId: portfolio.user_id,
    balance: portfolio.balance,
    invested: portfolio.invested,
    transactions: (transactions || []).map(tx => ({
      id: tx.id,
      asset: tx.asset,
      ticker: tx.ticker,
      emoji: tx.emoji,
      amount: tx.amount,
      timestamp: tx.created_at,
    })),
  }
}

// Save a transaction and update portfolio balance
export async function saveTransaction(
  asset: string,
  ticker: string,
  emoji: string,
  amount: number
): Promise<Portfolio> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  // 1. Insert transaction
  await supabase.from('transactions').insert({
    user_id: user.id,
    asset,
    ticker,
    emoji,
    amount,
  })

  // 2. Update portfolio balance
  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('user_id', user.id)
    .single()

  await supabase
    .from('portfolios')
    .update({
      balance: portfolio.balance - amount,
      invested: portfolio.invested + amount,
    })
    .eq('user_id', user.id)

  // 3. Return updated portfolio
  const updated = await getPortfolio()
  return updated!
}