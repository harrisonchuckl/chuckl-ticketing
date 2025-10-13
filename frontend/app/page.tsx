export const dynamic='force-dynamic';
async function getEvents(){ const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/events`, { cache:'no-store' }); return res.json(); }
export default async function Page(){ const events = await getEvents(); return (<div>
  <h1>Upcoming Shows</h1>
  <ul>{events.map((e:any)=>(<li key={e.id}><a href={`/events/${e.id}`}>{e.title} — {new Date(e.startsAtUTC).toLocaleString()}</a></li>))}</ul>
</div>); }