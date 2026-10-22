/* Inventory: missing/expired identity, ordinary Google user, non-Google admin,
 * true admin, missing/error flag, re-read after revocation; callback success,
 * cancelled/missing/expired code and network failure; sign-out success/failure. */
import { beforeEach,expect,it,vi } from "vitest";
const h=vi.hoisted(()=>({client:vi.fn(),redirect:vi.fn((path:string)=>{throw new Error(path)})}));
vi.mock("@/lib/supabase/server",()=>({createClient:h.client}));
vi.mock("next/navigation",()=>({redirect:h.redirect}));
import { requireAdmin } from "@/lib/auth";
import { GET } from "@/app/auth/callback/route";
import { signOut } from "@/app/auth/actions";
let user:unknown;let profile:unknown;let authError:unknown;let profileError:unknown;
let exchange:ReturnType<typeof vi.fn>;let out:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.clearAllMocks();user={id:"u",app_metadata:{provider:"google"}};profile={is_superadmin:true};authError=null;profileError=null;exchange=vi.fn(async()=>({error:null}));out=vi.fn(async()=>({error:null}));const db={select:vi.fn(()=>db),eq:vi.fn(()=>db),maybeSingle:vi.fn(async()=>({data:profile,error:profileError}))};h.client.mockResolvedValue({auth:{getUser:vi.fn(async()=>({data:{user},error:authError})),exchangeCodeForSession:exchange,signOut:out},from:vi.fn(()=>db)})});
it("returns a verified admin",async()=>expect((await requireAdmin()).user).toEqual(user));
it("rejects missing and invalid users",async()=>{user=null;await expect(requireAdmin()).rejects.toThrow("/login");user={id:"u"};authError="expired";await expect(requireAdmin()).rejects.toThrow("/login")});
it.each([null,{}, {is_superadmin:false},{is_superadmin:"true"}])("denies unavailable or non-admin DB flag %j",async p=>{profile=p;await expect(requireAdmin()).rejects.toThrow("restricted")});
it("denies DB read failure and non-Google admin",async()=>{profileError="offline";await expect(requireAdmin()).rejects.toThrow("restricted");profileError=null;user={id:"u",app_metadata:{provider:"email"}};await expect(requireAdmin()).rejects.toThrow("restricted")});
it("does not retain privileges after revocation",async()=>{await requireAdmin();profile={is_superadmin:false};await expect(requireAdmin()).rejects.toThrow("restricted");expect(h.client).toHaveBeenCalledTimes(2)});
it("callback exchanges code and uses a fixed relative destination",async()=>{const r=await GET(new Request("https://example.com/auth/callback?code=abc&next=https://evil.example"));expect(r.status).toBe(303);expect(r.headers.get("location")).toBe("/");expect(exchange).toHaveBeenCalledWith("abc")});
it.each(["","?error=access_denied","?code=abc&error=denied"])("callback handles absent/cancelled auth %s",async query=>{expect((await GET(new Request(`https://example.com/auth/callback${query}`))).headers.get("location")).toBe("/login?reason=auth");expect(exchange).not.toHaveBeenCalled()});
it("callback catches expired codes and connection failure",async()=>{exchange.mockResolvedValueOnce({error:"expired"});expect((await GET(new Request("https://example.com/auth/callback?code=x"))).headers.get("location")).toBe("/login?reason=auth");exchange.mockRejectedValueOnce(new Error("down"));expect((await GET(new Request("https://example.com/auth/callback?code=x"))).headers.get("location")).toBe("/login?reason=auth")});
it("signs out locally",async()=>{await expect(signOut()).rejects.toThrow("/login");expect(out).toHaveBeenCalledWith({scope:"local"})});
it("reports failed sign out",async()=>{out.mockResolvedValueOnce({error:"down"});await expect(signOut()).rejects.toThrow("Sign-out failed")});
