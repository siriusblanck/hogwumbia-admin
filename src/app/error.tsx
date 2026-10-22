"use client";
import { useTransition } from "react";
import { Spinner } from "@/components/action-feedback";
export default function ErrorPage({reset}:{reset:()=>void}) {
  const [pending, startTransition] = useTransition();
  return <section className="error-page"><h1>Unable to load this page.</h1><p>Please try again. No changes have been confirmed.</p><button className="button primary" disabled={pending} aria-busy={pending} onClick={() => startTransition(reset)}>{pending && <Spinner/>}{pending ? "Retrying…" : "Try again"}</button></section>;
}
