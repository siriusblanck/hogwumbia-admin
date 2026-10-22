"use client";
import { useActionState, useState } from "react";
import { createMedia, updateMedia, deleteMedia } from "@/app/(admin)/media/actions";
import { ActionButton, Disclosure, FormFeedback } from "./action-feedback";
export function CreateForm({writers}: {writers:{id:string;name:string}[]}) {
  const [state,action,pending]=useActionState(createMedia,{});
  const [character, setCharacter] = useState("");
  const [twist, setTwist] = useState("");
  return <form action={action} className="editor-form" aria-busy={pending}>
    <fieldset className="editor-fields" disabled={pending}>
      <label htmlFor="character_id">Character</label><select name="character_id" id="character_id" required value={character} onChange={event => setCharacter(event.target.value)}><option value="" disabled>Choose a character…</option>{writers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <label htmlFor="twist">Twist <span className="muted">(optional)</span></label><textarea id="twist" name="twist" value={twist} onChange={event => setTwist(event.target.value)} maxLength={140} rows={3} placeholder="Add a detail for the post…"/><p className="fine">140 characters maximum.</p>
      <FormFeedback state={state} pending={pending}/><ActionButton pending={pending} pendingLabel="Generating…">Generate & publish →</ActionButton>
    </fieldset>
    {pending && <div className="generation-progress" role="status"><div className="generation-preview" aria-hidden="true"><div className="skeleton-block"/><div><div className="skeleton-block"/><div className="skeleton-block"/></div></div><p>Generating caption and image…</p><div className="action-progress" aria-hidden="true"><i/></div></div>}
  </form>;
}
export function EditForm({id,caption,alt}: {id:string;caption:string;alt:string}) {
  const [state,action,pending]=useActionState(updateMedia,{});
  const [draftCaption, setDraftCaption] = useState(caption);
  const [draftAlt, setDraftAlt] = useState(alt);
  return <form className="editor-form" action={action} aria-busy={pending}><input type="hidden" name="id" value={id}/><fieldset className="editor-fields" disabled={pending}><label htmlFor="caption">Caption</label><textarea id="caption" name="caption" value={draftCaption} onChange={event => setDraftCaption(event.target.value)} maxLength={200} required rows={4}/><p className="fine">200 characters maximum.</p><label htmlFor="image_alt">Image description</label><textarea id="image_alt" name="image_alt" value={draftAlt} onChange={event => setDraftAlt(event.target.value)} required maxLength={600} rows={4}/><p className="fine">Alt text for screen readers.</p><FormFeedback state={state} pending={pending}/><ActionButton pending={pending} pendingLabel="Saving…">Save changes</ActionButton></fieldset></form>;
}
export function DeleteForm({id}: {id:string}) {
  const [state,action,pending]=useActionState(deleteMedia,{});
  return <Disclosure className="delete-zone" title="Delete post"><p>This permanently deletes the post, its image, and its votes.</p><form action={action} className="editor-form" aria-busy={pending}><input type="hidden" name="id" value={id}/><fieldset className="editor-fields" disabled={pending}><label htmlFor="confirmation">Type DELETE to confirm</label><input id="confirmation" name="confirmation" autoComplete="off" required pattern="DELETE"/><FormFeedback state={state} pending={pending}/><ActionButton className="button danger" pending={pending} pendingLabel="Deleting…">Delete permanently</ActionButton></fieldset></form></Disclosure>;
}
