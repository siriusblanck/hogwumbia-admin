"use client";
import { TransitionLink, useAdminNavigation } from "./admin-transitions";
import { Spinner } from "./action-feedback";
const links = [["/","Overview","◈"],["/profiles","Profiles","♙"],["/media","Media library","▧"],["/votes","Votes & ratings","↕"]];
export default function Navigation() {
  const { pathname: path, pending } = useAdminNavigation();
  return <nav aria-label="Admin navigation">{links.map(([href,label,icon]) => {
    const active = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
    return <TransitionLink key={href} href={href} aria-current={active ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span className="nav-text">{label}</span><span className="nav-status">{active && pending && <Spinner />}</span></TransitionLink>;
  })}</nav>;
}
