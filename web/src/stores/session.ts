import { create } from 'zustand'
import { authApi } from '../services'
import type { Role, User } from '../services'

interface SessionState {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  loginAs: (role: Role) => Promise<User>
  logout: () => void
}

export const useSession = create<SessionState>((set) => ({
  user: authApi.current(),
  async login(email, password) {
    const user = await authApi.login(email, password)
    set({ user })
    return user
  },
  async loginAs(role) {
    const user = await authApi.loginAs(role)
    set({ user })
    return user
  },
  logout() {
    authApi.logout()
    set({ user: null })
  },
}))
