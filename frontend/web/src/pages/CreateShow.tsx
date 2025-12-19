import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api";

type Venue = { id: string; name: string; city?: string | null };

export default function CreateShow() {

  const [title, setTitle] = useState("");
  const [venueQ, setVenueQ] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<string>("");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seatingFlow, setSeatingFlow] = useState<"UNALLOCATED" | "ALLOCATED">("UNALLOCATED");

  useEffect(() => {
    let alive = true;
    api.searchVenues(venueQ)
      .then(({ items }) => { if (alive) setVenues(items || []); })
      .catch(() => { if (alive) setVenues([]); });
    return () => { alive = false; };
  }, [venueQ]);

  const canSave = useMemo(() => !!(title.trim() && venueId && date), [title, venueId, date]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!canSave) return;

    setSaving(true);
    try {
      const { showId } = await api.createShow({
        title: title.trim(),
        venueId,
        date, // accepted as YYYY-MM-DD or ISO by the API (also supports DD/MM/YYYY)
        description: description.trim() || undefined
      });

 if (seatingFlow === "ALLOCATED") {
        window.location.href = `/admin/seating/builder/preview/${showId}?layout=blank`;
      } else {
        window.location.href = `/admin/seating/unallocated/${showId}`;
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to save show");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 860, margin: "2rem auto", padding: "1rem" }}>
      <h1>Create a New Show</h1>
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gap: "1rem" }}>
          <label>
            Show title
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Chuckl. Comedy Club"
              required
            />
          </label>

          <div>
            <label>
              Find venue
              <input
                type="text"
                value={venueQ}
                onChange={e => setVenueQ(e.target.value)}
                placeholder="Type to search name/city/postcode…"
              />
            </label>
            <label style={{ display: "block", marginTop: 6 }}>
              Select venue
              <select value={venueId} onChange={e => setVenueId(e.target.value)} required>
                <option value="">— Select —</option>
                {venues.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.city ? ` (${v.city})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Date (UK format shown by your browser)
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>

          <label>
            Description (optional)
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Internal notes / blurb"
            />
          </label>

          {err && <p style={{ color: "crimson" }}>{err}</p>}

         <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Next step
              <select
                value={seatingFlow}
                onChange={(e) => setSeatingFlow(e.target.value as "UNALLOCATED" | "ALLOCATED")}
                disabled={saving}
              >
                <option value="UNALLOCATED">Save Show and Add Unallocated Seating</option>
                <option value="ALLOCATED">Save Show and Add Allocated Seating</option>
              </select>
            </label>

            <button type="submit" disabled={!canSave || saving}>
              {saving
                ? "Saving…"
                : seatingFlow === "ALLOCATED"
                ? "Save Show and Add Allocated Seating"
                : "Save Show and Add Unallocated Seating"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
