"use client";
import { navigationDestination } from "@/lib/admin/navigation";
import { TransitionLink, useAdminNavigation } from "./admin-transitions";
export default function Search({ q, placeholder }: { q: string; placeholder: string }) {
  const { navigate } = useAdminNavigation();
  return <form className="search" role="search" onSubmit={event => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    const destination = navigationDestination(`?${new URLSearchParams({ q: value })}`, window.location.href);
    if (destination) navigate(destination);
  }}><label className="sr-only" htmlFor="q">{placeholder}</label><span aria-hidden="true">⌕</span><input key={q} id="q" name="q" defaultValue={q} placeholder={placeholder} maxLength={100} /><button className="button small">Search</button>{q && <TransitionLink href="?">Clear</TransitionLink>}</form>;
}
