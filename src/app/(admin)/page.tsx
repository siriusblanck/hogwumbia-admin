import Link from "next/link";
import Image from "next/image";
import { loadSnapshot, mediaUrl } from "@/lib/admin/data";
import { statistics } from "@/lib/admin/statistics";
import { Heading, House, Empty } from "@/components/ui";
export default async function Overview() {
  const data = await loadSnapshot(); const s = statistics(data, new Date());
  const chartMax = Math.max(1,...s.activity.flatMap(d => [d.posts,d.votes]));
  const houseMax = Math.max(1,...s.houses.map(h => Math.abs(h.points)));
  return <><Heading label="A VIEW FROM THE OWLERY" title="Mischief, measured." description="The people, posts, and petty opinions keeping Hog Wumbia alive." action={<Link className="button primary" href="/media/new">+ Create a post</Link>}/>
    <section className="metrics" aria-label="All-time statistics">{[
      ["Registered profiles",data.profiles.length,`${s.contributors} have published a post`,"♙"],
      ["Owls delivered",data.media.length,`${s.weeklyPosts} this week`,"↗"],
      ["Votes cast",data.votes.length,`${s.upvotes} up · ${s.downvotes} down`,"↕"],
      ["Campus approval",s.approval === null ? "—" : `${s.approval}%`,"Upvotes as a share of all votes","✧"],
    ].map(([label,value,sub,icon]) => <article className="metric" key={label}><p>{label}<span aria-hidden="true">{icon}</span></p><strong>{value}</strong><small>{sub}</small></article>)}</section>
    <div className="dashboard-grid"><section className="panel activity"><div className="panel-heading"><div><p className="eyebrow">THE CAMPUS PULSE</p><h2>Is anyone laughing?</h2></div><span className="pill">Last 14 days</span></div><p className="chart-key"><span><i className="posts-key"/>Posts</span><span><i className="votes-key"/>Votes</span></p>
      <div className="chart" role="img" aria-label={s.activity.map(d=>`${d.date}: ${d.posts} posts, ${d.votes} votes`).join("; ")}>{s.activity.map((d,i)=><div className="chart-day" key={d.date} title={`${d.date}: ${d.posts} posts, ${d.votes} votes`}><div className="bars"><i style={{height:`${100*d.posts/chartMax}%`}}/><i style={{height:`${100*d.votes/chartMax}%`}}/></div><small>{i%3===0 || i===13 ? d.date.slice(5).replace("-","/") : ""}</small></div>)}</div><p className="fine">Posts by publication day · Votes by creation day · New York time</p></section>
    <section className="panel cup"><div className="panel-heading"><div><p className="eyebrow">THIS WEEK’S HOUSE CUP</p><h2>Bragging rights.</h2></div><span className="trophy" aria-hidden="true">♜</span></div><p className="muted small-copy">Net votes on posts published since {s.monday}.</p><div className="house-list">{s.houses.map((h,i)=><div key={h.house}><div className="house-line"><span className="rank">0{i+1}</span><House house={h.house}/><strong>{h.points}<small> pts</small></strong></div><div className="house-track" data-house={h.house}><i style={{width:`${100*Math.abs(h.points)/houseMax}%`}}/></div></div>)}</div></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">THE WRITERS’ ROOM</p><h2>Who’s doing the talking?</h2></div></div>{s.writers.length ? s.writers.slice(0,5).map((w,i)=><div className="writer-line" key={w.name}><span className="writer-initial">{w.name.slice(0,1)}</span><div><strong>{w.name}</strong><small>{w.points} net points</small></div><span>{w.count} posts</span><span className="rank">#{i+1}</span></div>) : <Empty>No writers have published yet.</Empty>}</section>
    <section className="panel spotlight"><p className="eyebrow">{s.divisive ? "THE POST THAT SPLIT THE ROOM" : "THE CAMPUS FAVORITE"}</p><h2>{s.divisive ? "A matter of taste." : "Top of the post."}</h2>{(s.divisive ?? s.top) ? (()=>{const m=(s.divisive ?? s.top)!;return <Link href={`/media/${m.id}`} className="spotlight-card"><Image src={mediaUrl(m.image_path)} alt={m.image_alt || "Generated campus illustration"} width={140} height={160}/><div><p>{m.caption}</p><small>{m.author_display}</small><div className="vote-counts"><span>↑ {m.upvotes}</span><span>↓ {m.downvotes}</span></div></div></Link>})() : <Empty>The first post gets the spotlight.</Empty>}<Link className="text-link" href="/votes">Read the room →</Link></section></div>
  </>;
}
