import { loadSnapshot } from "@/lib/admin/data";
import { listQuery, paginate } from "@/lib/admin/validation";
import { Heading, House, Search, Pagination, Empty, dateLabel } from "@/components/ui";
export default async function Profiles({ searchParams }: { searchParams: Promise<{q?:string;page?:string}> }) {
  const {q,page}=listQuery(await searchParams), data=await loadSnapshot();
  const result=paginate(data.profiles.filter(p=>`${p.first_name} ${p.last_name} ${p.house} ${p.id}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.created_at.localeCompare(a.created_at)),page);
  return <><Heading title="Profiles"/><Search q={q} placeholder="Search names, houses, or profile IDs…"/><section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Member</th><th>House</th><th>Posts</th><th>Votes cast</th><th>Access</th><th>Joined</th></tr></thead><tbody>{result.rows.map(p=><tr key={p.id}><td><strong>{[p.first_name,p.last_name].filter(Boolean).join(" ") || "Profile incomplete"}</strong><small className="record-id">{p.id}</small></td><td><House house={p.house}/></td><td>{data.media.filter(m=>m.author_id===p.id).length}</td><td>{data.votes.filter(v=>v.voter_id===p.id).length}</td><td><span className={`pill ${p.is_superadmin ? "admin-pill" : ""}`}>{p.is_superadmin ? "Superadmin" : "Member"}</span></td><td>{dateLabel(p.created_at)}</td></tr>)}</tbody></table></div>{!result.total && <Empty>No profiles match your search.</Empty>}<Pagination {...result} q={q}/></section></>;
}
