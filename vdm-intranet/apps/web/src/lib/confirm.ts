export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

// We store the resolve callback at module level (just a function reference).
// The window event is used to notify the portal — window is immune to HMR module re-evaluation.
let _resolve: ((value: boolean) => void) | null = null

const OPEN_EVENT = '__vdm_confirm_open'
const CLOSE_EVENT = '__vdm_confirm_close'

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    _resolve?.(false)
    _resolve = resolve
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: options }))
    }
  })
}

export function resolveConfirm(value: boolean) {
  _resolve?.(value)
  _resolve = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT))
  }
}

export function subscribeConfirm(
  onOpen: (opts: ConfirmOptions) => void,
  onClose: () => void
): () => void {
  function handleOpen(e: Event) {
    onOpen((e as CustomEvent<ConfirmOptions>).detail)
  }
  window.addEventListener(OPEN_EVENT, handleOpen)
  window.addEventListener(CLOSE_EVENT, onClose)
  return () => {
    window.removeEventListener(OPEN_EVENT, handleOpen)
    window.removeEventListener(CLOSE_EVENT, onClose)
  }
}
