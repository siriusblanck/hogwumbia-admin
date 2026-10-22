import SignInButton from "@/app/sign-in-button";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/action-feedback";
export default async function Login({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return <main className="login"><div className="login-stars" aria-hidden="true">✦</div><div className="login-card">
    <span className="seal">HW</span>
    <h1>The Owlery</h1>
    {reason === "restricted" && <p className="notice error" role="alert">This Google account is not an administrator. Switch to an account with staff access.</p>}
    {reason === "auth" && <p className="notice error" role="alert">Google sign-in did not finish. Please try again.</p>}
    <SignInButton label="Continue with Google" className="button primary google" icon={<span aria-hidden="true">G</span>}/>
    {user && <form action={signOut}><SubmitButton pendingLabel="Signing out…">Switch accounts</SubmitButton></form>}
  </div></main>;
}
