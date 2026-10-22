import Link from "next/link";
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
  return <><Link href="/media" className="text-link">← Media library</Link><Heading label="A FRESH BIT OF MISCHIEF" title="Send something funny." description="One character, a campus prompt, and your own terrible idea."/><div className="editor-layout"><section className="panel"><CreateForm writers={writers}/></section><aside className="panel topic-card"><p className="eyebrow">THIS WEEK’S PROMPT</p><h2>{topic?.headline ?? "No prompt is available."}</h2><p>{topic?.scene}</p><hr/><p className="fine">Your twist takes priority when it changes the scene. Caption and illustration are generated together using the same character voices as Hog Wumbia.</p></aside></div></>;
}
