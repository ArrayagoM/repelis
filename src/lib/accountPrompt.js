// Pedido de cuenta global: cualquier botón puede pedir "para esto necesitás cuenta" y <AccountPromptHost/> lo muestra.
import { useSyncExternalStore } from 'react'

let current = null
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

export const requestAccount = (prompt) => { current = { reason: 'list', title: '', ...prompt }; emit() }
export const dismissAccountPrompt = () => { if (current) { current = null; emit() } }
export const getAccountPrompt = () => current
export const useAccountPrompt = () =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn) }, getAccountPrompt, getAccountPrompt)
