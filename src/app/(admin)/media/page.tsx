import Link from "next/link";
import Image from "next/image";
import { loadSnapshot, mediaUrl } from "@/lib/admin/data";
import { listQuery, paginate } from "@/lib/admin/validation";
import { Heading, House, Search, Pagination, Empty } from "@/components/ui";
export default async function Library({ searchParams }: { searchParams: Promise<{q?:string;page?:string;deleted?:string;cleanup?:string}> }) {
  const params=await searchParams, {q,page}=listQuery(params), data=await loadSnapshot();
  const result=paginate(data.media.filter(m=>`${m.caption} ${m.author_display} ${m.house} ${m.id}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.created_at.localeCompare(a.created_at)),page);
  return <><Heading label="THE PUBLISHED COLLECTION" title="All the pretty petty." description="Review, edit, create, or retire a post. Changes appear in Hog Wumbia." action={<Link className="button primary" href="/media/new">+ Create a post</Link>}/>
    {params.deleted && <p className="notice" role="status">Post and associated votes deleted.{params.cleanup === "pending" && " Image cleanup is pending; the post is no longer published."}</p>}
    <Search q={q} placeholder="Search captions, authors, houses, or IDs…"/>{!result.total ? <Empty>No posts found. The owlery is quiet.</Empty> : <div className="media-grid">{result.rows.map(m=><article className="media-card" key={m.id}><Link className="media-image" href={`/media/${m.id}`}><Image src={mediaUrl(m.image_path)} alt={m.image_alt || "AI-generated campus illustration"} width={480} height={400}/><span className="image-badge">AI generated</span></Link><div className="media-body"><House house={m.house}/><h2><Link href={`/media/${m.id}`}>{m.caption}</Link></h2><p className="fine">{m.author_display} · {m.owl_post_date}</p><div className="card-bottom"><span>↑ {m.upvotes} <span className="muted">↓ {m.downvotes}</span></span><Link className="text-link" href={`/media/${m.id}`}>Review & edit ↗</Link></div></div></article>)}</div>}<Pagination {...result} q={q}/></>;
}
