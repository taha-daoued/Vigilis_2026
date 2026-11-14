import { create } from 'zustand'

export interface Toast {
  id: number
  title: string
  detail?: string
}

interface ToastState {
  toasts: Toast[]
  push: (title: string, detail?: string) => void
  dismiss: (id: number) => void
}

let nextId = 1
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(title, detail) {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-3), { id, title, detail }] })
    setTimeout(() => get().dismiss(id), 6000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
