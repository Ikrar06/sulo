import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { getActiveSection, SCROLLSPY_OFFSET } from "../scrollspy"

export interface TocItem {
  id: string
  label: string
}

/** Fallback for browsers without `scrollend`: the scroll counts as finished after 150 ms without a scroll event. */
const SCROLL_IDLE_MS = 150

type ScrollRoot = { el: HTMLElement | null; top: () => number; height: () => number; scrollHeight: () => number; target: HTMLElement | Window }

/** The element that actually scrolls: the nearest scrollable ancestor, else the document (the dashboard scrolls the window). */
function findScrollRoot(from: HTMLElement | null): ScrollRoot {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      return { el, top: () => el.scrollTop, height: () => el.clientHeight, scrollHeight: () => el.scrollHeight, target: el }
    }
  }
  const doc = document.scrollingElement as HTMLElement
  return { el: null, top: () => doc.scrollTop, height: () => window.innerHeight, scrollHeight: () => doc.scrollHeight, target: window }
}

/** Section tops measured in the scroll container's content coordinates. */
function offsetsOf(ids: readonly string[], root: ScrollRoot): number[] {
  const base = root.el ? root.el.getBoundingClientRect().top : 0
  return ids.map((id) => {
    const el = document.getElementById(id)
    return el ? el.getBoundingClientRect().top - base + root.top() : Number.POSITIVE_INFINITY
  })
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

/**
 * Scrollspy for the table of contents. Recomputed on scroll (one per
 * animation frame) and resize with getActiveSection(). A click marks its item
 * at once and locks out scroll updates until the scroll ends.
 */
function useScrollspy(ids: readonly string[], content: RefObject<HTMLDivElement | null>, hashFor: (id: string) => string) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const [bottomPad, setBottomPad] = useState(0)
  const locked = useRef(false)
  const key = ids.join("|")

  useEffect(() => {
    if (ids.length === 0) return
    const root = findScrollRoot(content.current)
    let frame = 0
    const update = () => {
      frame = 0
      if (locked.current) return
      const i = getActiveSection(offsetsOf(ids, root), root.top(), root.height(), root.scrollHeight())
      setActive(i >= 0 ? ids[i]! : null)
    }
    // Room under the last section so its heading can rise close to the top, never more than the screen needs.
    const measurePad = () => {
      const last = document.getElementById(ids[ids.length - 1]!)
      if (!last) return
      setBottomPad(Math.max(0, Math.min(root.height() * 0.5, root.height() - last.offsetHeight - SCROLLSPY_OFFSET - 64)))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onResize = () => {
      measurePad()
      onScroll()
    }
    measurePad()
    update()
    root.target.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      root.target.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      if (frame) cancelAnimationFrame(frame)
    }
    // `key` stands for the id list (a new array each render).
  }, [key, content])

  const go = useCallback(
    (id: string) => {
      const section = document.getElementById(id)
      if (!section) return
      const root = findScrollRoot(content.current)
      setActive(id)
      locked.current = true
      let idle = 0
      const unlock = () => {
        locked.current = false
        root.target.removeEventListener("scroll", onMove)
        root.target.removeEventListener("scrollend", unlock)
        window.clearTimeout(idle)
      }
      // `scrollend` where supported; otherwise 150 ms without a scroll event ends the lock.
      const onMove = () => {
        window.clearTimeout(idle)
        idle = window.setTimeout(unlock, SCROLL_IDLE_MS)
      }
      root.target.addEventListener("scroll", onMove, { passive: true })
      root.target.addEventListener("scrollend", unlock, { once: true })
      idle = window.setTimeout(unlock, SCROLL_IDLE_MS)
      section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" })
      // Focus moves to the section heading (reachable by script only), and the address names the section.
      const heading = section.querySelector<HTMLElement>("h2, h3") ?? section
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1")
      heading.focus({ preventScroll: true })
      history.replaceState(history.state, "", `#${hashFor(id)}`)
    },
    [content, hashFor],
  )
  return { active, go, bottomPad }
}

const linkBase = "block rounded px-2 py-1 text-[14px] outline-none focus-ring:ring-2 focus-ring:ring-focus"

/**
 * Document pages (Bantuan, Tentang, Privasi): the text at 68ch and a 280 px
 * aside that stays in view (top 24, 48 px apart). Below 1100 px the table of
 * contents moves above the text as a row that scrolls sideways, and the
 * rest of the aside follows the text. Without `toc` there is no contents list.
 */
export function DocLayout({ toc = [], tocLabel = "", aside, hashFor = (id) => id, children }: { toc?: readonly TocItem[]; tocLabel?: string; aside?: ReactNode; hashFor?: (id: string) => string; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const { active, go, bottomPad } = useScrollspy(
    toc.map((t) => t.id),
    content,
    hashFor,
  )
  const link = (t: TocItem, inline: boolean) => (
    <a
      key={t.id}
      href={`#${hashFor(t.id)}`}
      onClick={(e) => {
        e.preventDefault()
        go(t.id)
      }}
      aria-current={active === t.id ? "location" : undefined}
      className={`${linkBase} ${inline ? "shrink-0 whitespace-nowrap" : ""} ${active === t.id ? "bg-surface-raised font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {t.label}
    </a>
  )
  const hasToc = toc.length > 0
  return (
    <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,68ch)_280px] min-[1100px]:gap-x-12">
      {hasToc && (
        <nav aria-label={tocLabel} className="-mx-1 flex gap-1 overflow-x-auto pb-1 min-[1100px]:hidden">
          {toc.map((t) => link(t, true))}
        </nav>
      )}
      <div ref={content} className="min-w-0 space-y-4 [&_section[id]]:scroll-mt-6" style={hasToc ? { paddingBottom: bottomPad } : undefined}>
        {children}
      </div>
      <aside className="hidden min-[1100px]:block">
        <div className="sticky top-6 space-y-4">
          {hasToc && (
            <nav aria-label={tocLabel} data-toc>
              <p className="mb-2 px-2 text-[12px] font-semibold text-muted-foreground">{tocLabel}</p>
              <div className="space-y-1">{toc.map((t) => link(t, false))}</div>
            </nav>
          )}
          {aside}
        </div>
      </aside>
      {aside && <div className="space-y-4 min-[1100px]:hidden">{aside}</div>}
    </div>
  )
}
