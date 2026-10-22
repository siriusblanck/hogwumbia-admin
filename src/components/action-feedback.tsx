"use client";
import { useId, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/admin/validation";

export function Spinner() { return <span className="spinner" aria-hidden="true" />; }

export function ActionButton({ pending, children, pendingLabel, className = "button primary" }: { pending: boolean; children: ReactNode; pendingLabel: string; className?: string }) {
  return <button className={className} disabled={pending} aria-busy={pending}>
    {pending && <Spinner />}<span className="button-label" key={String(pending)}>{pending ? pendingLabel : children}</span>
  </button>;
}

export function SubmitButton({ children, pendingLabel, className = "text-link", label }: { children: ReactNode; pendingLabel: string; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} aria-busy={pending} aria-label={pending ? pendingLabel : label}>
    {pending ? <><Spinner /><span className={label ? "sr-only" : ""}>{pendingLabel}</span></> : children}
  </button>;
}

export function FormFeedback({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending) return null;
  return <>{state.error && <p className="notice error" role="alert"><span aria-hidden="true">!</span>{state.error}</p>}{state.success && <p className="notice" role="status"><span className="success-check" aria-hidden="true">✓</span>{state.success}</p>}</>;
}

export function Disclosure({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className={`disclosure ${className}`} data-open={open}>
    <button className="disclosure-toggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{title}<span aria-hidden="true">⌄</span></button>
    <div className="disclosure-panel" id={id} aria-hidden={!open} inert={!open}><div className="disclosure-inner">{children}</div></div>
  </section>;
}
