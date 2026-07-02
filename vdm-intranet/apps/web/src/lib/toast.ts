export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration: number
}

// We use window CustomEvents so the bus survives HMR module re-evaluation.
const ADD_EVENT    = '__vdm_toast_add'
const REMOVE_EVENT = '__vdm_toast_remove'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function add(type: ToastType, message: string, duration = 4000) {
  if (typeof window === 'undefined') return
  const item: ToastItem = { id: uid(), type, message, duration }
  window.dispatchEvent(new CustomEvent(ADD_EVENT, { detail: item }))
}

export function dismissToast(id: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(REMOVE_EVENT, { detail: id }))
}

export function subscribeToasts(
  onAdd: (item: ToastItem) => void,
  onRemove: (id: string) => void,
): () => void {
  function handleAdd(e: Event) { onAdd((e as CustomEvent<ToastItem>).detail) }
  function handleRemove(e: Event) { onRemove((e as CustomEvent<string>).detail) }
  window.addEventListener(ADD_EVENT, handleAdd)
  window.addEventListener(REMOVE_EVENT, handleRemove)
  return () => {
    window.removeEventListener(ADD_EVENT, handleAdd)
    window.removeEventListener(REMOVE_EVENT, handleRemove)
  }
}

export const toast = {
  success: (message: string, duration?: number) => add('success', message, duration),
  error:   (message: string, duration?: number) => add('error',   message, duration ?? 5000),
  info:    (message: string, duration?: number) => add('info',    message, duration),
  warning: (message: string, duration?: number) => add('warning', message, duration),
}
