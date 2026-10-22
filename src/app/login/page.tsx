import SignInButton from "@/app/sign-in-button";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
export default async function Login({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return <main className="login"><div className="login-stars" aria-hidden="true">✦</div><div className="login-card">
    <span className="seal">HW</span><p className="eyebrow">Hog Wumbia · Staff entrance</p>
    <h1>The Owlery</h1><p className="lead">A little oversight.<br/><em>A lot of mischief.</em></p>
    <p className="muted">The private office behind Columbia’s least serious newspaper.</p>
    {reason === "restricted" && <p className="notice error" role="alert">This Google account is not an administrator. Switch to an account with staff access.</p>}
    {reason === "auth" && <p className="notice error" role="alert">Google sign-in did not finish. Please try again.</p>}
    <SignInButton label="Continue with Google" className="button primary google" icon={<span aria-hidden="true">G</span>}/>
    {user && <form action={signOut}><button className="text-link">Sign out & switch accounts</button></form>}
    <p className="fine">Google sign-in required · Authorized staff only</p>
  </div><p className="login-footer">The house elves asked for a dashboard. We delivered.</p></main>;
}
