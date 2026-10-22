import Link from "next/link";
export function Heading({ label, title, description, action }: { label: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{label}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>;
}
export function House({ house }: { house: string | null }) { return <span className="house" data-house={house ?? "none"}><i/>{house ?? "Unsorted"}</span>; }
export function Search({ q, placeholder }: { q: string; placeholder: string }) { return <form className="search" role="search"><label className="sr-only" htmlFor="q">{placeholder}</label><span aria-hidden="true">⌕</span><input id="q" name="q" defaultValue={q} placeholder={placeholder} maxLength={100}/><button className="button small">Search</button>{q && <Link href="?">Clear</Link>}</form>; }
export function Pagination({ page, pages, total, q }: { page: number; pages: number; total: number; q: string }) {
  const url = (p: number) => `?${new URLSearchParams({q,page:String(p)})}`;
  return <div className="pagination"><span>{total} record{total === 1 ? "" : "s"} · Page {page} of {pages}</span><div>{page > 1 && <Link className="button small" href={url(page-1)}>← Previous</Link>}{page < pages && <Link className="button small" href={url(page+1)}>Next →</Link>}</div></div>;
}
export function Empty({ children }: { children: React.ReactNode }) { return <div className="empty"><span aria-hidden="true">✧</span><p>{children}</p></div>; }
export function dateLabel(date: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(new Date(date)); }
