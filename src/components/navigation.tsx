"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [["/","Overview","◈"],["/profiles","Profiles","♙"],["/media","Media library","▧"],["/votes","Votes & ratings","↕"]];
export default function Navigation() {
  const path = usePathname();
  return <nav aria-label="Admin navigation">{links.map(([href,label,icon]) => <Link key={href} href={href} aria-current={(href === "/" ? path === "/" : path.startsWith(href)) ? "page" : undefined}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>;
}
