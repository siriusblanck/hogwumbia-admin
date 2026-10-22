"use client";

import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { NAVIGATION_FEEDBACK_MS, navigationDestination, type Destination } from "@/lib/admin/navigation";
import PageSkeleton from "./page-skeleton";

type NavigationState = { pending: boolean; pathname: string; navigate: (destination: Destination) => void };
const NavigationContext = createContext<NavigationState | null>(null);

export function AdminTransitions({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] = useState<Destination | null>(null);
  const begin = useCallback((next: Destination, commit?: () => void) => {
    setDestination(next);
    startTransition(async () => {
      commit?.(); // Start the request immediately; keep a brief, readable skeleton for cached routes too.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      await new Promise<void>(resolve => setTimeout(resolve, reduce ? 0 : NAVIGATION_FEEDBACK_MS));
    });
  }, []);
  const navigate = useCallback((next: Destination) => begin(next, () => router.push(next.href)), [begin, router]);

  useEffect(() => {
    const onBackOrForward = () => begin({ href: window.location.pathname + window.location.search, pathname: window.location.pathname });
    window.addEventListener("popstate", onBackOrForward);
    return () => window.removeEventListener("popstate", onBackOrForward);
  }, [begin]);

  return <NavigationContext.Provider value={{ pending, pathname: pending && destination ? destination.pathname : pathname, navigate }}>
    {pending && <div className="route-progress" aria-hidden="true"><i /></div>}
    {children}
  </NavigationContext.Provider>;
}

export function useAdminNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("Admin navigation requires AdminTransitions.");
  return context;
}

export function TransitionLink({ href, ...props }: Omit<ComponentProps<typeof NextLink>, "href" | "onNavigate"> & { href: string }) {
  const { navigate } = useAdminNavigation();
  return <NextLink {...props} href={href} onNavigate={event => {
    const destination = navigationDestination(href, window.location.href);
    if (!destination) return;
    event.preventDefault();
    navigate(destination);
  }} />;
}

export function RouteContent({ children }: { children: ReactNode }) {
  const navigation = useAdminNavigation();
  const pathname = usePathname();
  const search = useSearchParams();
  return <div className="route-stage" aria-busy={navigation.pending}>
    {navigation.pending && <PageSkeleton pathname={navigation.pathname} />}
    <div key={`${pathname}?${search.toString()}`} className="route-content" hidden={navigation.pending}>{children}</div>
  </div>;
}
