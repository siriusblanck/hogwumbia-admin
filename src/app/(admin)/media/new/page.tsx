import { TransitionLink as Link } from "@/components/admin-transitions";
import { requireAdmin } from "@/lib/auth";
import { loadGenerationContext } from "@/lib/owl-post/repository";
import { pickOwlPost } from "@/lib/owl-post/owl-posts";
import { newYorkDate } from "@/lib/owl-post/dates";
import { isAvailableWriter } from "@/lib/characters";
import { Heading } from "@/components/ui";
import { CreateForm } from "@/components/media-forms";
export default async function NewMedia() {
  const {supabase}=await requireAdmin(); const context=await loadGenerationContext(supabase);
  const topic=pickOwlPost(context.owlPosts,newYorkDate(new Date()));
  const writers=context.cast.filter(isAvailableWriter).map(w=>({id:w.id,name:w.name}));
  return <><Link href="/media" className="text-link">← Media library</Link><Heading title="Create post"/><div className="editor-layout"><section className="panel"><CreateForm writers={writers}/></section><aside className="panel topic-card"><p className="eyebrow">THIS WEEK’S PROMPT</p><h2>{topic?.headline ?? "No prompt is available."}</h2><p>{topic?.scene}</p></aside></div></>;
}
