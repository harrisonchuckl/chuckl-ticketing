// src/admin/pages/ShowTicketsPage.tsx

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  TicketType,
  fetchTicketTypes,
  createTicketType,
  updateTicketType,
  deleteTicketType,
  fetchShow,
  ShowSummary,
} from "../api/ticketsSeatmapsApi";

type RouteParams = {
  showId: string;
};

const poundsFromPence = (pence: number) => (pence / 100).toFixed(2);
const toPence = (pounds: string) => Math.round(Number(pounds || "0") * 100);

const ShowTicketsPage: React.FC = () => {
  const { showId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [show, setShow] = useState<ShowSummary | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newAvailable, setNewAvailable] = useState("");

  useEffect(() => {
    if (!showId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [showData, types] = await Promise.all([
          fetchShow(showId),
          fetchTicketTypes(showId),
        ]);
        if (cancelled) return;
        setShow(showData);
        setTicketTypes(types);
      } catch (e: any) {
        if (!cancelled) {
          console.error(e);
          setError(e?.message ?? "Failed to load tickets");
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

  const handleAddTicketType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showId) return;

    const name = newName.trim();
    if (!name) {
      setError("Ticket name is required");
      return;
    }

    const pricePence = toPence(newPrice);
    if (pricePence < 0 || Number.isNaN(pricePence)) {
      setError("Price must be a valid number");
      return;
    }

    const available =
      newAvailable.trim() === "" ? undefined : Number(newAvailable);

    if (available !== undefined && (available < 0 || Number.isNaN(available))) {
      setError("Available must be a non-negative number");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createTicketType(showId, {
        name,
        pricePence,
        available: available ?? null,
      });
      setTicketTypes((prev) => [...prev, created]);
      setNewName("");
      setNewPrice("");
      setNewAvailable("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to create ticket type");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    id: string,
    fields: Partial<{ name: string; price: string; available: string }>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const current = ticketTypes.find((t) => t.id === id);
      if (!current) return;

      const payload: any = {};

      if (fields.name != null) {
        payload.name = fields.name.trim();
      }
      if (fields.price != null) {
        const pence = toPence(fields.price);
        if (pence < 0 || Number.isNaN(pence)) {
          throw new Error("Price must be a valid number");
        }
        payload.pricePence = pence;
      }
      if (fields.available != null) {
        const trimmed = fields.available.trim();
        if (trimmed === "") {
          payload.available = null;
        } else {
          const val = Number(trimmed);
          if (val < 0 || Number.isNaN(val)) {
            throw new Error("Available must be a non-negative number");
          }
          payload.available = val;
        }
      }

      const updated = await updateTicketType(id, payload);

      setTicketTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updated } : t))
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to update ticket type");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this ticket type?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTicketType(id);
      setTicketTypes((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to delete ticket type");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSeatMapClick = () => {
    if (!showId) return;
    navigate(`/admin/ui/shows/${showId}/seating`);
  };

  if (!showId) {
    return <div className="p-6">Missing showId in route.</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate("/admin/ui/shows")}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to all shows
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Tickets</h1>
      {show && (
        <p className="text-sm text-slate-600 mb-4">
          {show.title}{" "}
          <span className="text-slate-400">({new Date(show.startsAt).toLocaleString("en-GB")})</span>
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
          {/* Ticket structure area – keep light for now */}
          <section className="mb-8 border border-slate-200 rounded-lg p-4 bg-white">
            <h2 className="font-medium mb-2">Ticket structure</h2>
            <p className="text-xs text-slate-500 mb-3">
              Tickets can be sold as general admission or using an allocated
              seating map.
            </p>
            <div className="flex gap-4 mb-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="ticketStructure"
                  defaultChecked
                  readOnly
                />
                <span>General admission</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm opacity-60">
                <input type="radio" name="ticketStructure" disabled />
                <span>Allocated seating (uses seat maps)</span>
              </label>
            </div>
            <button
              type="button"
              onClick={handleCreateSeatMapClick}
              className="inline-flex items-center px-3 py-1.5 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
            >
              Create / edit seat map
            </button>
          </section>

          {/* Ticket types table */}
          <section className="border border-slate-200 rounded-lg p-4 bg-white">
            <h2 className="font-medium mb-3">Ticket types</h2>

            {ticketTypes.length === 0 ? (
              <p className="text-sm text-slate-500 mb-4">
                No ticket types yet. Add your first ticket type below.
              </p>
            ) : (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-2 px-2">Name</th>
                      <th className="text-left py-2 px-2">Price (£)</th>
                      <th className="text-left py-2 px-2">Available</th>
                      <th className="py-2 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketTypes.map((t) => (
                      <TicketTypeRow
                        key={t.id}
                        type={t}
                        onChange={(fields) => handleUpdate(t.id, fields)}
                        onDelete={() => handleDelete(t.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add new ticket type */}
            <form onSubmit={handleAddTicketType} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Name
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm min-w-[160px]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Standard"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Price (£)
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-24"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="15"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Available (optional)
                </label>
                <input
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-24"
                  value={newAvailable}
                  onChange={(e) => setNewAvailable(e.target.value)}
                  placeholder="leave blank"
                  inputMode="numeric"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save ticket type"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
};

type TicketTypeRowProps = {
  type: TicketType;
  onChange: (fields: { name?: string; price?: string; available?: string }) => void;
  onDelete: () => void;
};

const TicketTypeRow: React.FC<TicketTypeRowProps> = ({
  type,
  onChange,
  onDelete,
}) => {
  const [name, setName] = useState(type.name);
  const [price, setPrice] = useState(poundsFromPence(type.pricePence));
  const [available, setAvailable] = useState(
    type.available == null ? "" : String(type.available)
  );

  useEffect(() => {
    setName(type.name);
    setPrice(poundsFromPence(type.pricePence));
    setAvailable(type.available == null ? "" : String(type.available));
  }, [type]);

  const handleBlur = () => {
    onChange({ name, price, available });
  };

  return (
    <tr className="border-b border-slate-200">
      <td className="py-2 px-2">
        <input
          className="border border-slate-300 rounded px-2 py-1 text-sm w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlur}
        />
      </td>
      <td className="py-2 px-2">
        <input
          className="border border-slate-300 rounded px-2 py-1 text-sm w-24"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={handleBlur}
          inputMode="decimal"
        />
      </td>
      <td className="py-2 px-2">
        <input
          className="border border-slate-300 rounded px-2 py-1 text-sm w-24"
          value={available}
          onChange={(e) => setAvailable(e.target.value)}
          onBlur={handleBlur}
          inputMode="numeric"
        />
      </td>
      <td className="py-2 px-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-red-600 hover:text-red-700"
        >
          Delete
        </button>
      </td>
    </tr>
  );
};

export default ShowTicketsPage;
