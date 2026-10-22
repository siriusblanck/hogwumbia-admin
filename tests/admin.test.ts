/* Behavior inventory:
 * Access: Google + true DB flag only; missing/false/string flags and other providers deny.
 * Reads/actions: deny before a privileged client is created, including forged IDs.
 * Edits: valid boundary lengths, empty/oversize/invalid types, allowlisted fields only;
 *         database errors, missing rows, successful invalidation.
 * Deletes: exact confirmation; row failure never removes storage; cleanup warning on failure.
 * Creates: valid identity/complete profile, bad input, model failure, success redirect.
 * Statistics: empty/zero votes, downvotes, week boundaries in NY, net totals, rankings.
 * Pagination/search: empty, arrays, hostile numbers/strings, bounds, last page.
 * Ambiguity: profile and vote management is read-only per rubric; admin media creation
 *           uses the same quotas and author profile as the public app.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
const h=vi.hoisted(()=>({ requireAdmin:vi.fn(),admin:vi.fn(),revalidate:vi.fn(),redirect:vi.fn((path:string)=>{throw new Error(`redirect:${path}`)}),create:vi.fn(),deps:vi.fn(),server:vi.fn() }));
vi.mock("@/lib/auth",()=>({requireAdmin:h.requireAdmin}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:h.admin}));
vi.mock("next/cache",()=>({revalidatePath:h.revalidate}));
vi.mock("next/navigation",()=>({redirect:h.redirect}));
vi.mock("@/lib/owl-post/create-generation",()=>({createGeneration:h.create}));
vi.mock("@/lib/owl-post/generation-deps",()=>({buildGenerationDeps:h.deps}));
vi.mock("@/lib/supabase/server",()=>({createClient:h.server}));
import { hasAdminAccess } from "@/lib/admin/access";
import { editSchema,deleteSchema,listQuery,paginate } from "@/lib/admin/validation";
import { statistics } from "@/lib/admin/statistics";
import { createMedia,updateMedia,deleteMedia } from "@/app/(admin)/media/actions";
import { loadMedia,loadSnapshot,mediaUrl,type Snapshot,type Media } from "@/lib/admin/data";
const id="c270c3da-f5b1-47dd-8e21-b76703c91c2f";
const id2="892c1fff-2698-4c28-bffd-8f1eb5df182b";
const form=(o:Record<string,string>)=>{const f=new FormData();for(const [k,v]of Object.entries(o))f.set(k,v);return f;};
let result:{data:unknown;error:unknown};let db:Record<string,ReturnType<typeof vi.fn>>;let remove:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 vi.clearAllMocks();h.requireAdmin.mockResolvedValue({user:{id},profile:{id,first_name:"Test",last_name:"Admin",house:"ravenclaw"},supabase:{}});
 result={data:{id,image_path:`${id}/a.png`},error:null};
 db={};for(const key of ["from","select","update","delete","eq","order"])db[key]=vi.fn(()=>db);
 db.maybeSingle=vi.fn(async()=>result);db.range=vi.fn(async()=>({data:[],error:null}));
 remove=vi.fn(async()=>({error:null}));h.admin.mockReturnValue({...db,storage:{from:vi.fn(()=>({remove}))}});
 h.create.mockResolvedValue({ok:true,generationId:id});
});
describe("authorization predicate",()=>{
 it("accepts Google with a literal database true",()=>expect(hasAdminAccess({app_metadata:{provider:"google"}},{is_superadmin:true})).toBe(true));
 it.each([null,{}, {is_superadmin:false},{is_superadmin:"true"},{is_superadmin:1}])("denies bad flags %j",p=>expect(hasAdminAccess({app_metadata:{provider:"google"}},p)).toBe(false));
 it.each([null,{}, {app_metadata:{}},{app_metadata:{provider:"email"}},{app_metadata:{provider:["google"]}}])("denies other identities %j",u=>expect(hasAdminAccess(u,{is_superadmin:true})).toBe(false));
});
describe("validation",()=>{
 it.each([1,199,200])("accepts caption boundary %i",n=>expect(editSchema.safeParse({id,caption:"a".repeat(n),image_alt:"scene"}).success).toBe(true));
 it.each(["", " ", "a".repeat(201),null,0,[],{}])("rejects bad captions %j",caption=>expect(editSchema.safeParse({id,caption,image_alt:"scene"}).success).toBe(false));
 it.each([1,599,600])("accepts alt boundary %i",n=>expect(editSchema.safeParse({id,caption:"caption",image_alt:"a".repeat(n)}).success).toBe(true));
 it.each([""," ","a".repeat(601),null,0,[],{}])("rejects bad descriptions %j",image_alt=>expect(editSchema.safeParse({id,caption:"caption",image_alt}).success).toBe(false));
 it.each(["", "not-a-uuid",null,[],0])("rejects bad IDs %j",bad=>expect(editSchema.safeParse({id:bad,caption:"a",image_alt:"b"}).success).toBe(false));
 it("strips ownership and privileges",()=>expect(editSchema.parse({id,caption:" caption ",image_alt:" scene ",author_id:id2,is_superadmin:true})).toEqual({id,caption:"caption",image_alt:"scene"}));
 it.each(["delete"," DELETE","",true,null])("requires exact deletion confirmation %j",confirmation=>expect(deleteSchema.safeParse({id,confirmation}).success).toBe(false));
 it("accepts exact confirmation",()=>expect(deleteSchema.safeParse({id,confirmation:"DELETE"}).success).toBe(true));
 it.each([undefined,"", "-2","NaN","Infinity","1.5","1000000",["2"]])("safe page input %j",page=>expect(listQuery({page}).page).toBe(1));
 it("trims and caps search and rejects arrays",()=>{expect(listQuery({q:" x ",page:"2"})).toEqual({q:"x",page:2});expect(listQuery({q:["x"]}).q).toBe("");expect(listQuery({q:"a".repeat(200)}).q).toHaveLength(100);expect(listQuery({page:"0"}).page).toBe(1)});
 it("paginates and clamps out-of-range pages",()=>{const rows=Array.from({length:13},(_,i)=>i);expect(paginate(rows,2)).toEqual({rows:[12],page:2,pages:2,total:13});expect(paginate(rows,999).rows).toEqual([12]);expect(paginate([],1)).toEqual({rows:[],page:1,pages:1,total:0});expect(paginate(rows,NaN).page).toBe(1);expect(paginate(rows,-2).page).toBe(1)});
});
describe("protected data and mutations",()=>{
 it.each([()=>loadSnapshot(),()=>loadMedia(id),()=>updateMedia({},form({id,caption:"hi",image_alt:"scene"})),()=>deleteMedia({},form({id,confirmation:"DELETE"})),()=>createMedia({},form({character_id:id,twist:""}))])("never touches privileged client after auth denial",async call=>{h.requireAdmin.mockRejectedValueOnce(new Error("denied"));await expect(call()).rejects.toThrow("denied");expect(h.admin).not.toHaveBeenCalled();expect(h.create).not.toHaveBeenCalled()});
 it("edits only allowed columns and invalidates",async()=>{expect(await updateMedia({},form({id,caption:" hi ",image_alt:" scene ",author_id:id2,is_superadmin:"true"}))).toEqual({success:"Changes saved. The public card is updated."});expect(db.update).toHaveBeenCalledWith({caption:"hi",image_alt:"scene"});expect(db.eq).toHaveBeenCalledWith("id",id);expect(h.revalidate).toHaveBeenCalledWith("/","layout")});
 it("rejects invalid edit before DB",async()=>{expect((await updateMedia({},form({id,caption:"",image_alt:"x"}))).error).toContain("1–200");expect(h.admin).not.toHaveBeenCalled()});
 it("reports edit errors and missing posts",async()=>{result={data:null,error:{message:"secret db error"}};expect((await updateMedia({},form({id,caption:"a",image_alt:"b"}))).error).toBe("The post could not be saved. Try again.");result.error=null;expect((await updateMedia({},form({id,caption:"a",image_alt:"b"}))).error).toBe("This post no longer exists.")});
 it("rejects unconfirmed deletion",async()=>{expect((await deleteMedia({},form({id,confirmation:"no"}))).error).toContain("Type DELETE");expect(h.admin).not.toHaveBeenCalled()});
 it("does not delete image when row deletion fails or row is missing",async()=>{result={data:null,error:"failed"};expect((await deleteMedia({},form({id,confirmation:"DELETE"}))).error).toContain("could not be deleted");result.error=null;expect((await deleteMedia({},form({id,confirmation:"DELETE"}))).error).toContain("no longer exists");expect(remove).not.toHaveBeenCalled()});
 it("deletes stored image only after row success",async()=>{await expect(deleteMedia({},form({id,confirmation:"DELETE"}))).rejects.toThrow("redirect:/media?deleted=1");expect(remove).toHaveBeenCalledWith([`${id}/a.png`]);expect(db.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0])});
 it("surfaces image cleanup failure",async()=>{remove.mockResolvedValueOnce({error:"offline"});await expect(deleteMedia({},form({id,confirmation:"DELETE"}))).rejects.toThrow("cleanup=pending")});
 it("rejects invalid creation without model calls",async()=>{expect((await createMedia({},form({character_id:"bad",twist:""}))).error).toContain("Choose");expect(h.create).not.toHaveBeenCalled()});
 it("requires complete profile",async()=>{h.requireAdmin.mockResolvedValueOnce({user:{id},profile:{first_name:null,last_name:null,house:null},supabase:{}});expect((await createMedia({},form({character_id:id,twist:""}))).error).toContain("Choose your name");expect(h.create).not.toHaveBeenCalled()});
 it("keeps model errors visible",async()=>{h.create.mockResolvedValueOnce({ok:false,error:"Daily limit"});expect(await createMedia({},form({character_id:id,twist:""}))).toEqual({error:"Daily limit"})});
 it("creates with session identity, ignoring forged owner",async()=>{await expect(createMedia({},form({character_id:id2,twist:"hello",author_id:id2}))).rejects.toThrow(`redirect:/media/${id}?created=1`);expect(h.create).toHaveBeenCalledWith(undefined,{id,first_name:"Test",last_name:"Admin",house:"ravenclaw"},{characterId:id2,twist:"hello"})});
 it("rejects invalid ID, missing media and read error",async()=>{expect(await loadMedia("bad")).toBeNull();expect(h.admin).not.toHaveBeenCalled();result={data:null,error:null};expect(await loadMedia(id)).toBeNull();result.error="fail";await expect(loadMedia(id)).rejects.toThrow("could not be loaded")});
 it("loads empty database correctly and fails closed on DB errors",async()=>{expect(await loadSnapshot()).toEqual({profiles:[],media:[],votes:[],writers:[]});db.range.mockResolvedValueOnce({data:null,error:"private error"});await expect(loadSnapshot()).rejects.toThrow("could not be loaded")});
 it("encodes storage URL components",()=>{vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://test.supabase.co");expect(mediaUrl("user/a b.png")).toBe("https://test.supabase.co/storage/v1/object/public/generations/user/a%20b.png");vi.unstubAllEnvs()});
});
const empty:Snapshot={profiles:[],media:[],votes:[],writers:[]};
const media=(partial:Partial<Media>):Media=>({id,author_id:id,author_display:"Test A.",house:"ravenclaw",character_id:id,owl_post_id:id,owl_post_date:"2026-10-19",caption:"hi",image_path:`${id}/a.png`,image_alt:"scene",user_twist:null,caption_prompt:"p",image_prompt:"p",caption_model:"m",image_model:"i",upvotes:3,downvotes:1,score:2,created_at:"2026-10-19T17:00:00Z",...partial});
describe("real statistics",()=>{
 it("empty data has no fabricated approval, winner or controversy",()=>{const s=statistics(empty,new Date("2026-10-22T12:00:00Z"));expect(s.approval).toBeNull();expect(s.top).toBeNull();expect(s.divisive).toBeNull();expect(s.houses.map(h=>h.points)).toEqual([0,0,0,0]);expect(s.activity).toHaveLength(14);expect(s.activity.every(d=>d.votes===0 && d.posts===0)).toBe(true)});
 it("respects NY week boundaries, negative points, approval and distinct authors",()=>{
 const d:Snapshot={...empty,media:[media({owl_post_date:"2026-10-18",score:99}),media({id:id2,score:-1,upvotes:1,downvotes:2}),media({owl_post_date:"2026-10-23",score:88})],votes:[{generation_id:id,voter_id:id,value:1,created_at:"2026-10-20T01:00:00Z"},{generation_id:id,voter_id:id2,value:-1,created_at:"2026-10-20T01:00:00Z"}],writers:[{id,name:"Ron",is_active:true}]};
 const s=statistics(d,new Date("2026-10-22T12:00:00Z"));expect(s.weeklyPosts).toBe(1);expect(s.houses.find(h=>h.house==="ravenclaw")?.points).toBe(-1);expect(s.approval).toBe(50);expect(s.contributors).toBe(1);expect(s.activity.find(d=>d.date==="2026-10-19")?.votes).toBe(2);expect(s.writers[0]).toEqual({name:"Ron",count:3,points:186});expect(s.top?.score).toBe(99);expect(s.divisive).not.toBeNull();
 });
 it("Sunday night UTC stays in the previous New York week",()=>expect(statistics(empty,new Date("2026-10-19T01:00:00Z")).monday).toBe("2026-10-12"));
});
it("loads valid media and rejects malformed provider records",async()=>{result={data:media({}),error:null};expect((await loadMedia(id))?.caption).toBe("hi");result.data={id};await expect(loadMedia(id)).rejects.toThrow()});
it("reads beyond Supabase's 1000-row page without truncating data",async()=>{let pages=0;db.range.mockImplementation(async()=>({data:pages++===0?Array.from({length:1000},()=>({id,first_name:null,last_name:null,house:null,is_superadmin:false,created_at:"2026-10-22T12:00:00Z"})):[],error:null}));const snapshot=await loadSnapshot();expect(snapshot.profiles).toHaveLength(1000);expect(db.range).toHaveBeenCalledWith(1000,1999)});
it("ranks multiple writers and controversial posts, including retired unnamed writers",()=>{const a=media({upvotes:4,downvotes:3,score:1});const b=media({id:id2,character_id:id2,upvotes:5,downvotes:4,score:1});const d:Snapshot={...empty,media:[a,b,media({id:id2,character_id:id2,upvotes:6,downvotes:0,score:6})],writers:[{id,name:null,is_active:false},{id:id2,name:"Harry",is_active:true}],votes:[{generation_id:id,voter_id:id,value:-1,created_at:"2026-10-22T12:00:00Z"}]};const s=statistics(d,new Date("2026-10-22T12:00:00Z"));expect(s.writers.map(w=>w.name)).toEqual(["Harry","Retired writer"]);expect(s.divisive?.downvotes).toBe(4);expect(s.approval).toBe(0)});
