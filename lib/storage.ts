// ─── lib/storage.ts ───────────────────────────────────────────────────────────
// This file is the ONLY place that reads/writes data.
// Right now it uses localStorage (browser storage).
// Later, swap these functions for Supabase calls — nothing else needs to change.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string
  createdAt: string
}

export interface Transaction {
  id: string
  asset: string      // "Apple"
  ticker: string     // "AAPL"
  emoji: string      // "🍎"
  amount: number     // dollars invested
  timestamp: string
}

export interface Portfolio {
  userId: string
  balance: number        // remaining cash
  invested: number       // total dollars invested
  transactions: Transaction[]
}

// ─── Keys ────────────────────────────────────────────────────────────────────
const KEYS = {
  user: 'firstrade_user',
  portfolio: 'firstrade_portfolio',
}

// ─── User ────────────────────────────────────────────────────────────────────

// Create an anonymous user (no email/password yet)
export function createUser(): User {
  const user: User = {
    id: `user_${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(KEYS.user, JSON.stringify(user))
  return user
}

// Get existing user or null
export function getUser(): User | null {
  const data = localStorage.getItem(KEYS.user)
  return data ? JSON.parse(data) : null
}

// ─── Portfolio ───────────────────────────────────────────────────────────────

const STARTING_BALANCE = 10000

// Create a fresh portfolio for a new user
export function createPortfolio(userId: string): Portfolio {
  const portfolio: Portfolio = {
    userId,
    balance: STARTING_BALANCE,
    invested: 0,
    transactions: [],
  }
  localStorage.setItem(KEYS.portfolio, JSON.stringify(portfolio))
  return portfolio
}

// Get existing portfolio or null
export function getPortfolio(): Portfolio | null {
  const data = localStorage.getItem(KEYS.portfolio)
  return data ? JSON.parse(data) : null
}

// Save a transaction and update balance
export function saveTransaction(
  asset: string,
  ticker: string,
  emoji: string,
  amount: number
): Portfolio {
  const portfolio = getPortfolio()
  if (!portfolio) throw new Error('No portfolio found')

  const transaction: Transaction = {
    id: `tx_${Date.now()}`,
    asset,
    ticker,
    emoji,
    amount,
    timestamp: new Date().toISOString(),
  }

  const updated: Portfolio = {
    ...portfolio,
    balance: portfolio.balance - amount,
    invested: portfolio.invested + amount,
    transactions: [...portfolio.transactions, transaction],
  }

  localStorage.setItem(KEYS.portfolio, JSON.stringify(updated))
  return updated
}

// Clear everything (useful for testing / logout later)
export function clearStorage(): void {
  localStorage.removeItem(KEYS.user)
  localStorage.removeItem(KEYS.portfolio)
}