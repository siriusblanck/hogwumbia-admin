"use client";
import { useActionState } from "react";
import { createMedia, updateMedia, deleteMedia } from "@/app/(admin)/media/actions";
import type { FormState } from "@/lib/admin/validation";
function Message({state}: {state:FormState}) { return <>{state.error && <p className="notice error" role="alert">{state.error}</p>}{state.success && <p className="notice" role="status">{state.success}</p>}</>; }
export function CreateForm({writers}: {writers:{id:string;name:string}[]}) {
  const [state,action,pending]=useActionState(createMedia,{});
  return <form action={action} className="editor-form"><label htmlFor="character_id">Pick your writer</label><select name="character_id" id="character_id" required defaultValue=""><option value="" disabled>Choose a character…</option>{writers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><label htmlFor="twist">Add a twist <span className="muted">(optional)</span></label><textarea id="twist" name="twist" maxLength={140} rows={3} placeholder="My roommate has a very questionable solution…"/><p className="fine">Up to 140 characters. The AI writes the caption and creates the illustration.</p><Message state={state}/><button className="button primary" disabled={pending} aria-busy={pending}>{pending ? "Writing & illustrating…" : "Generate & publish →"}</button><p className="fine">Publishes to your house under your profile. The same daily generation limits apply.</p>{pending && <p role="status">The writer is at work. This can take about a minute.</p>}</form>;
}
export function EditForm({id,caption,alt}: {id:string;caption:string;alt:string}) {
  const [state,action,pending]=useActionState(updateMedia,{});
  return <form className="editor-form" action={action}><input type="hidden" name="id" value={id}/><label htmlFor="caption">Caption</label><textarea id="caption" name="caption" defaultValue={caption} maxLength={200} required rows={4}/><p className="fine">200 characters maximum. This is the text on the public card.</p><label htmlFor="image_alt">Image description</label><textarea id="image_alt" name="image_alt" defaultValue={alt} required maxLength={600} rows={4}/><p className="fine">Describe the illustration for people using screen readers.</p><Message state={state}/><button className="button primary" disabled={pending}>{pending?"Saving…":"Save changes"}</button></form>;
}
export function DeleteForm({id}: {id:string}) {
  const [state,action,pending]=useActionState(deleteMedia,{});
  return <details className="delete-zone"><summary>Remove this post</summary><p>This permanently deletes the card, its image, and its votes. House standings will recalculate.</p><form action={action} className="editor-form"><input type="hidden" name="id" value={id}/><label htmlFor="confirmation">Type DELETE to confirm</label><input id="confirmation" name="confirmation" autoComplete="off" required pattern="DELETE"/><Message state={state}/><button className="button danger" disabled={pending}>{pending?"Removing…":"Delete post permanently"}</button></form></details>;
}
