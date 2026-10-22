import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { loadMedia, mediaUrl } from "@/lib/admin/data";
import { Heading, House } from "@/components/ui";
import { EditForm, DeleteForm } from "@/components/media-forms";
export default async function Edit({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<{created?:string}>}) {
  const {id}=await params, m=await loadMedia(id);if(!m)notFound();const {created}=await searchParams;
  return <><Link className="text-link" href="/media">← Media library</Link><Heading label="ON THE EDITOR’S DESK" title="A closer look." description={`Published by ${m.author_display} · ${m.owl_post_date}`}/>{created && <p className="notice" role="status">Your new post is published.</p>}<div className="editor-layout"><div><article className="preview-card"><Image src={mediaUrl(m.image_path)} alt={m.image_alt || "Generated illustration"} width={600} height={700} loading="eager"/><div><House house={m.house}/><p>{m.caption}</p><span>↑ {m.upvotes} · ↓ {m.downvotes} · {m.score} net points</span></div></article><DeleteForm id={m.id}/></div><section className="panel"><h2>Make the final edit.</h2><EditForm id={m.id} caption={m.caption} alt={m.image_alt ?? ""}/><details className="provenance"><summary>Generation details & prompts</summary><dl><dt>Reader’s twist</dt><dd>{m.user_twist || "None"}</dd><dt>Text model</dt><dd>{m.caption_model}</dd><dt>Image model</dt><dd>{m.image_model}</dd><dt>Post ID</dt><dd>{m.id}</dd></dl><h3>Caption prompt</h3><pre>{m.caption_prompt}</pre><h3>Image prompt</h3><pre>{m.image_prompt}</pre></details></section></div></>;
}
