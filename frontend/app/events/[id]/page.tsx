export const dynamic='force-dynamic';
async function getEvent(id:string){ const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/events/${id}`, { cache:'no-store' }); return res.json(); }
export default async function EventPage({ params }:any){ const e = await getEvent(params.id); return (<div>
  <h1>{e.title}</h1><p><b>When:</b> {new Date(e.startsAtUTC).toLocaleString()}</p><p><b>Where:</b> {e.venue?.name}</p>
  <p>Choose quantities and proceed to checkout (wired via API on the backend).</p>
</div>); }