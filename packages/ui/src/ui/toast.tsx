import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

// Sulo's toast: one at a time, bottom centre, polite live region. A new toast
// replaces the old one. Hovering or focusing it pauses its timer; Esc
// closes it. Plain card (border and surface), no colored edge. Closing fades
// it out in 120 ms (opacity only; at once under reduced motion), on the
// phone too; a new toast during the fade takes its place at once.

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

/** The fade out when a toast closes. */
export const TOAST_EXIT_MS = 120
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

const ToastContext = createContext<{ show: (t: ToastOptions) => void; close: () => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast outside ToastProvider")
  return ctx
}

/** viewportClassName: where the toast sits (the Android app lifts it above its tab bar). */
export function ToastProvider({ children, viewportClassName = "bottom-6" }: { children: ReactNode; viewportClassName?: string }) {
  const [toast, setToast] = useState<Shown | null>(null)
  const [leaving, setLeaving] = useState(false)
  const seq = useRef(0)
  const exit = useRef<number | undefined>(undefined)
  const finish = useCallback(() => {
    window.clearTimeout(exit.current)
    setLeaving(false)
    setToast(null)
  }, [])
  const close = useCallback(() => {
    if (reducedMotion()) return finish()
    setLeaving(true)
    window.clearTimeout(exit.current)
    exit.current = window.setTimeout(finish, TOAST_EXIT_MS)
  }, [finish])
  const show = useCallback((t: ToastOptions) => {
    window.clearTimeout(exit.current)
    setLeaving(false)
    setToast({ ...t, id: ++seq.current })
  }, [])
  useEffect(() => () => window.clearTimeout(exit.current), [])
  const value = useMemo(() => ({ show, close }), [show, close])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 ${viewportClassName}`}>
        {toast && <ToastCard key={toast.id} toast={toast} leaving={leaving} onClose={close} />}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, leaving, onClose }: { toast: Shown; leaving: boolean; onClose: () => void }) {
  const duration = toast.duration ?? 5000
  const [paused, setPaused] = useState(false)
  const left = useRef(duration)
  const started = useRef(Date.now())

  useEffect(() => {
    if (paused || leaving) return
    started.current = Date.now()
    const timer = window.setTimeout(() => {
      toast.onTimeout?.()
      onClose()
    }, left.current)
    return () => {
      window.clearTimeout(timer)
      left.current -= Date.now() - started.current
    }
  }, [paused, leaving, toast, onClose])

  useEffect(() => {
    if (leaving) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      toast.onTimeout?.()
      onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [leaving, toast, onClose])

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${TOAST_EXIT_MS}ms ease-in` }}
      className={`sulo-toast flex min-h-12 ${leaving ? "pointer-events-none" : "pointer-events-auto"} items-center gap-4 rounded-xl border border-border bg-surface py-2 pr-2 pl-4 text-[14px] text-foreground shadow-sm`}
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
