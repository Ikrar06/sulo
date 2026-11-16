import { useEffect, useState, type ReactNode } from "react"

export interface TocItem {
  id: string
  label: string
}

/** The section nearest the top of the viewport, for the "Di halaman ini" highlight. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const key = ids.join("|")
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting)
        const first = ids.find((id) => seen.get(id))
        if (first) setActive(first)
      },
      // A band in the upper part of the screen: a section counts once its top reaches it.
      { rootMargin: "0px 0px -60% 0px" },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // `key` stands for the id list (a new array each render).
  }, [key])
  return active
}

const linkBase = "block rounded px-2 py-1 text-[14px] outline-none focus-ring:ring-2 focus-ring:ring-focus"

/**
 * Document pages (Bantuan, Tentang, Privasi): the text at 68ch and a 280 px
 * aside that stays in view (top 24, 48 px apart). Below 1100 px the table of
 * contents moves above the text as a row that scrolls sideways, and the
 * rest of the aside follows the text.
 */
export function DocLayout({ toc, tocLabel, aside, children }: { toc: readonly TocItem[]; tocLabel: string; aside?: ReactNode; children: ReactNode }) {
  const active = useActiveSection(toc.map((t) => t.id))
  const link = (t: TocItem, inline: boolean) => (
    <a
      key={t.id}
      href={`#${t.id}`}
      onClick={(e) => {
        // Hash routes belong to the dashboard; scroll without changing the address.
        e.preventDefault()
        document.getElementById(t.id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
      }}
      aria-current={active === t.id ? "location" : undefined}
      className={`${linkBase} ${inline ? "shrink-0 whitespace-nowrap" : ""} ${active === t.id ? "bg-surface-raised font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {t.label}
    </a>
  )
  return (
    <div className="grid gap-6 min-[1100px]:grid-cols-[minmax(0,68ch)_280px] min-[1100px]:gap-x-12">
      <nav aria-label={tocLabel} className="-mx-1 flex gap-1 overflow-x-auto pb-1 min-[1100px]:hidden">
        {toc.map((t) => link(t, true))}
      </nav>
      <div className="min-w-0 space-y-4 [&_section[id]]:scroll-mt-6">{children}</div>
      <aside className="hidden min-[1100px]:block">
        <div className="sticky top-6 space-y-4">
          <nav aria-label={tocLabel}>
            <p className="mb-2 px-2 text-[12px] font-semibold text-muted-foreground">{tocLabel}</p>
            <div className="space-y-1">{toc.map((t) => link(t, false))}</div>
          </nav>
          {aside}
        </div>
      </aside>
      {aside && <div className="space-y-4 min-[1100px]:hidden">{aside}</div>}
    </div>
  )
}
