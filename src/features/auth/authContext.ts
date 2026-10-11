import { createContext } from 'react'
import type { AuthSnapshot, LoginResult } from './authController'

export interface AuthContextValue {
  snapshot: AuthSnapshot
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  retryRole: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
