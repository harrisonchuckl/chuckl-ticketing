import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./CreateShow.css";

type Venue = { id: string; name: string; city?: string | null };

export default function CreateShow() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [venueQ, setVenueQ] = useState("");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState<string>("");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [description, setDescription] = useState<string>("");
  const [videoUrlOne, setVideoUrlOne] = useState<string>("");
  const [videoUrlTwo, setVideoUrlTwo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        description: description.trim() || undefined,
        videoUrlOne: videoUrlOne.trim() || undefined,
        videoUrlTwo: videoUrlTwo.trim() || undefined,
      });

      // jump straight to ticket setup, pass venueId for seating suggestions
      nav(`/events/${showId}/tickets/setup?venueId=${encodeURIComponent(venueId)}`, { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Failed to save show");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="create-show-page">
      <header className="create-show-header">
        <p className="header-eyebrow">Create listing</p>
        <h1>Sell tickets faster with a clean listing</h1>
        <p className="header-subtitle">
          Add the basics, pick the venue, and publish. You can fine-tune ticket settings after saving.
        </p>
      </header>

      <form onSubmit={onSubmit} className="create-show-form">
        <section className="section-card">
          <div className="section-title">
            <div>
              <h2>Listing basics</h2>
              <p>Clear titles and descriptions help buyers trust your event.</p>
            </div>
            <span className="section-chip">Step 1</span>
          </div>

          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Chuckl. Comedy Club"
              required
            />
          </label>

          <label className="field">
            <span>Describe your show</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Give buyers a quick reason to attend (optional)."
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Video one</span>
              <input
                type="url"
                value={videoUrlOne}
                onChange={e => setVideoUrlOne(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </label>

            <label className="field">
              <span>Video two</span>
              <input
                type="url"
                value={videoUrlTwo}
                onChange={e => setVideoUrlTwo(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </label>
          </div>
        </section>

        <section className="section-card">
          <div className="section-title">
            <div>
              <h2>Venue & location</h2>
              <p>Search once, then choose the exact venue from the list.</p>
            </div>
            <span className="section-chip">Step 2</span>
          </div>

          <label className="field field-search">
            <span>Find a venue</span>
            <input
              type="text"
              value={venueQ}
              onChange={e => setVenueQ(e.target.value)}
              placeholder="Type to search name, city, or postcode"
            />
          </label>

          <label className="field">
            <span>Select venue</span>
            <select value={venueId} onChange={e => setVenueId(e.target.value)} required>
              <option value="">— Select —</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.city ? ` (${v.city})` : ""}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="section-card">
          <div className="section-title">
            <div>
              <h2>Schedule</h2>
              <p>Pick the date buyers should see on their tickets.</p>
            </div>
            <span className="section-chip">Step 3</span>
          </div>

          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </label>
        </section>

        <section className="info-card">
          <div>
            <p className="info-title">Tip: Add a clear title & venue name</p>
            <p className="info-text">Listings with specific venues and dates get booked faster.</p>
          </div>
          <span className="info-link">Learn more</span>
        </section>

        {err && <p className="error-text">{err}</p>}

        <div className="action-bar">
          <button type="submit" className="primary-button" disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save and add tickets"}
          </button>
          <p className="action-hint">You can edit details later.</p>
        </div>
      </form>
    </main>
  );
}
