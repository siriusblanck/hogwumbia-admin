import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import Navigation from "@/components/navigation";
import { AdminTransitions, RouteContent, TransitionLink as Link } from "@/components/admin-transitions";
import { SubmitButton } from "@/components/action-feedback";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return <AdminTransitions><div className="shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar">
    <Link className="brand" href="/"><span className="seal">HW</span><span>The Owlery<small>HOG WUMBIA ADMIN</small></span></Link>
    <Navigation/>
    <div className="staff"><span className="avatar">{profile.first_name?.slice(0,1).toUpperCase() || "A"}</span><div>{profile.first_name || "Administrator"}<small>Superadmin</small></div><form action={signOut}><SubmitButton label="Sign out" pendingLabel="Signing out…" className="staff-signout">↗</SubmitButton></form></div>
  </aside><div className="workspace"><header className="mobile-account"><span>{profile.first_name || "Administrator"}</span><form action={signOut}><SubmitButton pendingLabel="Signing out…">Sign out</SubmitButton></form></header><main id="main" className="content"><RouteContent>{children}</RouteContent></main></div></div></AdminTransitions>;
}
