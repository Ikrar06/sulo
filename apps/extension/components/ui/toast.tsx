import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

// Sulo's toast: one at a time, bottom centre, polite live region. A new toast
// replaces the old one. Hovering or focusing it pauses its timer; Esc
// closes it. Plain card (border and surface), no colored edge.

export interface ToastOptions {
  message: string
  action?: { label: string; onClick: () => void }
  /** ms; default 5000. */
  duration?: number
  /** Called when the toast closes by itself (timer or Esc), not when replaced or its action is used. */
  onTimeout?: () => void
}

interface Shown extends ToastOptions {
  id: number
}

const ToastContext = createContext<{ show: (t: ToastOptions) => void; close: () => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast outside ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Shown | null>(null)
  const seq = useRef(0)
  const show = useCallback((t: ToastOptions) => setToast({ ...t, id: ++seq.current }), [])
  const close = useCallback(() => setToast(null), [])
  const value = useMemo(() => ({ show, close }), [show, close])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && <ToastCard key={toast.id} toast={toast} onClose={() => setToast(null)} />}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onClose }: { toast: Shown; onClose: () => void }) {
  const duration = toast.duration ?? 5000
  const [paused, setPaused] = useState(false)
  const left = useRef(duration)
  const started = useRef(Date.now())

  useEffect(() => {
    if (paused) return
    started.current = Date.now()
    const timer = window.setTimeout(() => {
      toast.onTimeout?.()
      onClose()
    }, left.current)
    return () => {
      window.clearTimeout(timer)
      left.current -= Date.now() - started.current
    }
  }, [paused, toast, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      toast.onTimeout?.()
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toast, onClose])

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="sulo-toast pointer-events-auto flex min-h-12 items-center gap-4 rounded-xl border border-border bg-surface py-2 pr-2 pl-4 text-[14px] text-foreground shadow-sm"
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick()
            onClose()
          }}
          className="h-8 rounded-lg px-3 text-[14px] font-semibold outline-none hover:bg-surface-raised focus-ring:ring-2 focus-ring:ring-focus"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
