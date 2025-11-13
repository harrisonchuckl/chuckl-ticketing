// src/admin/pages/ShowSeatingPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchShow,
  fetchSeatMapsForShow,
  simpleGenerateSeatMap,
  SeatMap,
  ShowSummary,
} from "../api/ticketsSeatmapsApi";

type RouteParams = {
  showId: string;
};

const ShowSeatingPage: React.FC = () => {
  const { showId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [show, setShow] = useState<ShowSummary | null>(null);
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("Standard layout");
  const [rows, setRows] = useState("10");
  const [seatsPerRow, setSeatsPerRow] = useState("14");
  const [levelLabel, setLevelLabel] = useState("Stalls");

  useEffect(() => {
    if (!showId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [showData, maps] = await Promise.all([
          fetchShow(showId),
          fetchSeatMapsForShow(showId),
        ]);
        if (cancelled) return;
        setShow(showData);
        setSeatMaps(maps);

        if (maps.length > 0 && maps[0].name) {
          setName(maps[0].name);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setError(e?.message ?? "Failed to load seat maps");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [showId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showId) return;
    const r = Number(rows);
    const s = Number(seatsPerRow);
    if (!Number.isFinite(r) || r < 1 || !Number.isFinite(s) || s < 1) {
      setError("Rows and seats per row must be positive numbers");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const venueId = show?.venueId ?? undefined;
      const seatMap = await simpleGenerateSeatMap({
        showId,
        venueId,
        name: name.trim() || "Standard layout",
        rows: r,
        seatsPerRow: s,
        levelLabel: levelLabel.trim() || "Stalls",
      });

      setSeatMaps((prev) => [seatMap, ...prev.filter((m) => m.id !== seatMap.id)]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to generate seat map");
    } finally {
      setSaving(false);
    }
  };

  if (!showId) {
    return <div className="p-6">Missing showId in route.</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(`/admin/ui/shows/${showId}/tickets`)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to tickets
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Seating map</h1>
      {show && (
        <p className="text-sm text-slate-600 mb-4">
          {show.title}{" "}
          <span className="text-slate-400">({new Date(show.startsAt).toLocaleString("en-GB")})</span>
          {show.venueName && (
            <>
              {" "}
              · <span className="text-slate-500">{show.venueName}</span>
            </>
          )}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          {/* Existing seat maps */}
          <section className="mb-8 border border-slate-200 rounded-lg p-4 bg-white">
            <h2 className="font-medium mb-3">Existing seat maps</h2>
            {seatMaps.length === 0 ? (
              <p className="text-sm text-slate-500">
                No seat maps yet for this show. Use the form below to generate a simple layout.
              </p>
            ) : (
              <div className="space-y-3">
                {seatMaps.map((m) => (
                  <div
                    key={m.id}
                    className="border border-slate-200 rounded-md px-3 py-2 text-sm flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {m.name}{" "}
                        {m.isDefault && (
                          <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        Version {m.version} ·{" "}
                        {m.seats?.length ? `${m.seats.length} seats` : "seat count will appear once generated"}
                      </div>
                    </div>
                    {/* placeholder actions for future editor */}
                    <div className="text-xs text-slate-400">
                      (visual editor coming soon)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Simple generator */}
          <section className="border border-slate-200 rounded-lg p-4 bg-white">
            <h2 className="font-medium mb-3">Generate simple grid</h2>
            <p className="text-xs text-slate-500 mb-4">
              This creates a basic stalls-style layout with rows and seat numbers
              (e.g. A1–A14, B1–B14). You can refine this in a future visual editor.
            </p>

            <form
              onSubmit={handleGenerate}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl"
            >
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Layout name
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Standard layout"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Level label
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
                  value={levelLabel}
                  onChange={(e) => setLevelLabel(e.target.value)}
                  placeholder="Stalls"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Number of rows
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-32"
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Seats per row
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-32"
                  value={seatsPerRow}
                  onChange={(e) => setSeatsPerRow(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Generating…" : "Generate seat map"}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
};

export default ShowSeatingPage;
