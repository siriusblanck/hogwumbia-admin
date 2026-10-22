import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import Navigation from "@/components/navigation";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return <div className="shell"><a className="skip-link" href="#main">Skip to content</a><aside className="sidebar">
    <Link className="brand" href="/"><span className="seal">HW</span><span>The Owlery<small>HOG WUMBIA ADMIN</small></span></Link>
    <p className="nav-label">THE EDITOR’S DESK</p><Navigation/>
    <div className="sidebar-note"><span aria-hidden="true">✦</span><p>With great power<br/>comes great <em>pettiness.</em></p></div>
    <div className="staff"><span className="avatar">{profile.first_name?.slice(0,1).toUpperCase() || "A"}</span><div>{profile.first_name || "Administrator"}<small>Superadmin</small></div><form action={signOut}><button aria-label="Sign out" title="Sign out">↗</button></form></div>
  </aside><div className="workspace"><header className="topbar"><span><span className="live-dot"/> Editorial office</span><span className="private-label">Private access <span aria-hidden="true">✧</span><form className="mobile-signout" action={signOut}><button className="text-link">Sign out</button></form></span></header><main id="main" className="content">{children}</main><footer className="footer">Hog Wumbia <span>Columbia humour. Carefully supervised.</span></footer></div></div>;
}
