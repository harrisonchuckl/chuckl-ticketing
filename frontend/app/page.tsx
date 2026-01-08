export const dynamic = "force-dynamic";

type EventItem = {
  id: string;
  title?: string | null;
  date?: string | null;
};

async function getEvents(): Promise<EventItem[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE || "";
  const res = await fetch(`${base}/events`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

export default async function Page() {
  const events = await getEvents();
  return (
    <div>
      <h1>Upcoming Shows</h1>
      {events.length ? (
        <ul>
          {events.map(event => (
            <li key={event.id}>
              <a href={`/events/${event.id}`}>
                {event.title || "Untitled show"} —{" "}
                {event.date ? new Date(event.date).toLocaleString() : "TBC"}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No upcoming shows.</p>
      )}
    </div>
  );
}
