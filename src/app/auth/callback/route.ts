import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("code") && !params.has("error")) {
    try {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(params.get("code")!);
      if (!error) return new NextResponse(null, { status: 303, headers: { Location: "/" } });
    } catch { /* A failed exchange returns to a retryable public login. */ }
  }
  return new NextResponse(null, { status: 303, headers: { Location: "/login?reason=auth" } });
}
