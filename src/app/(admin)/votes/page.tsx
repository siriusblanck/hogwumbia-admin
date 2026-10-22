import Link from "next/link";
import { loadSnapshot } from "@/lib/admin/data";
import { listQuery, paginate } from "@/lib/admin/validation";
import { Heading, Search, Pagination, Empty, dateLabel } from "@/components/ui";
export default async function Votes({ searchParams }: { searchParams: Promise<{q?:string;page?:string;value?:string}> }) {
  const params=await searchParams, {q,page}=listQuery(params), data=await loadSnapshot();
  const profiles=new Map(data.profiles.map(p=>[p.id,[p.first_name,p.last_name].filter(Boolean).join(" ") || "Unnamed member"]));
  const media=new Map(data.media.map(m=>[m.id,m]));
  const result=paginate(data.votes.filter(v=>`${profiles.get(v.voter_id)} ${media.get(v.generation_id)?.caption} ${v.voter_id} ${v.value === 1 ? "upvote" : "downvote"}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.created_at.localeCompare(a.created_at)),page);
  return <><Heading label="THE AUDIENCE HAS SPOKEN" title="Read the room." description="Every upvote and downvote, with the member and post behind it. One vote per member per post."/><Search q={q} placeholder="Search a member, caption, upvote, or downvote…"/><section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Rating</th><th>Member</th><th>Post</th><th>Vote created</th></tr></thead><tbody>{result.rows.map(v=><tr key={`${v.generation_id}-${v.voter_id}`}><td><span className={`rating ${v.value===1?"up":"down"}`}>{v.value===1?"↑ Upvote":"↓ Downvote"}</span></td><td><strong>{profiles.get(v.voter_id) ?? "Removed member"}</strong><small className="record-id">{v.voter_id}</small></td><td className="caption-cell"><Link href={`/media/${v.generation_id}`}>{media.get(v.generation_id)?.caption ?? "Unavailable post"}</Link></td><td>{dateLabel(v.created_at)}</td></tr>)}</tbody></table></div>{!result.total && <Empty>No votes match this search.</Empty>}<Pagination {...result} q={q}/></section></>;
}
