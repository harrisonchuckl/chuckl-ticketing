import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";

type SeatingMap = {
  id: string;
  name: string;
  summary: string | null;
  rows: number | null;
  cols: number | null;
  updatedAt: string;
};

type TicketType = "FREE" | "PAID";
type SeatingType = "UNALLOCATED" | "ALLOCATED";

export default function TicketBuilder() {
  const { showId } = useParams<{ showId: string }>();
  const [search] = useSearchParams();
  const nav = useNavigate();

  const initialVenue = search.get("venueId") || "";

  const [venueId, setVenueId] = useState<string>(initialVenue);
  const [ticketType, setTicketType] = useState<TicketType>("PAID");
  const [price, setPrice] = useState<string>("25.00");
  const [feesIncluded, setFeesIncluded] = useState<boolean>(false);
  const [ticketName, setTicketName] = useState<string>("General Admission");
  const [ticketTypeId, setTicketTypeId] = useState<string | null>(null);
  const [ticketTypeAvailable, setTicketTypeAvailable] = useState<number | null>(null);

  const [seatingType, setSeatingType] = useState<SeatingType>("UNALLOCATED");
  const [capacity, setCapacity] = useState<number>(300);

  const [maps, setMaps] = useState<SeatingMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string>("");

  const showAllocatedOptions = seatingType === "ALLOCATED";

  useEffect(() => {
    if (!showId) return;
    let alive = true;
    api.getAdminShow(showId)
      .then(({ item }) => {
        if (!alive) return;
        if (item.venue?.id) {
          setVenueId(item.venue.id);
        } else if (item.venueId) {
          setVenueId(item.venueId);
        }
        if (item.usesAllocatedSeating != null) {
          setSeatingType(item.usesAllocatedSeating ? "ALLOCATED" : "UNALLOCATED");
        }
        if (item.showCapacity != null) {
          setCapacity(item.showCapacity);
        }
        if (item.activeSeatMapId) {
          setSelectedMapId(item.activeSeatMapId);
        }
        if (item.ticketTypes?.length) {
          const primaryTicket = item.ticketTypes[0];
          setTicketName(primaryTicket.name || "General Admission");
          setTicketTypeId(primaryTicket.id);
          setTicketTypeAvailable(primaryTicket.available ?? null);
          if (primaryTicket.pricePence > 0) {
            setTicketType("PAID");
            setPrice((primaryTicket.pricePence / 100).toFixed(2));
          } else {
            setTicketType("FREE");
            setPrice("0.00");
          }
        }
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [showId]);

  useEffect(() => {
    if (!venueId || !showAllocatedOptions) return;
    let alive = true;
    api.listSeatingMaps(venueId, 5)
      .then(({ maps }) => { if (alive) setMaps(maps); })
      .catch(() => { if (alive) setMaps([]); });
    return () => { alive = false; };
  }, [venueId, showAllocatedOptions]);

  const selectedMap = useMemo(
    () => maps.find(m => m.id === selectedMapId) || null,
    [maps, selectedMapId]
  );

  const selectedMapCapacity = useMemo(() => {
    if (!selectedMap || !selectedMap.rows || !selectedMap.cols) return null;
    return selectedMap.rows * selectedMap.cols;
  }, [selectedMap]);

  const saveAndContinue = async () => {
    if (showAllocatedOptions && !selectedMapId) {
      const go = confirm("No seating map selected. Do you want to open the Seating Map Builder?");
      if (go) {
        nav(`/events/${showId}/seating-map-builder?venueId=${encodeURIComponent(venueId)}`);
        return;
      }
    }
    if (!showId) return;

    const parsedPrice = Number(price);
    const pricePence = ticketType === "FREE"
      ? 0
      : Math.max(0, Math.round((Number.isFinite(parsedPrice) ? parsedPrice : 0) * 100));

    const computedAvailable = showAllocatedOptions
      ? (selectedMapCapacity ?? ticketTypeAvailable ?? capacity)
      : capacity;
    const available = Math.max(1, computedAvailable ?? 1);

    const bookingFeePence = feesIncluded ? 0 : undefined;

    try {
      await api.updateShow(showId, {
        venueId: venueId || null,
        usesAllocatedSeating: showAllocatedOptions,
        showCapacity: showAllocatedOptions ? null : capacity,
        activeSeatMapId: showAllocatedOptions ? (selectedMapId || null) : null,
      });

      if (ticketTypeId) {
        await api.updateTicketType(ticketTypeId, {
          name: ticketName,
          pricePence,
          bookingFeePence,
          available,
        });
      } else {
        await api.createTicketType(showId, {
          name: ticketName,
          pricePence,
          bookingFeePence,
          available,
        });
      }

      alert("Ticket settings saved.");
      nav(`/events/${showId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save ticket settings.";
      alert(message);
    }
  };

  return (
    <main style={{ maxWidth: 960, margin: "2rem auto", padding: "1rem" }}>
      <h1>Set Up Tickets</h1>
      <p>Show ID: <code>{showId}</code></p>

      <section style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Ticket Type</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <input
              type="radio"
              name="ticketType"
              checked={ticketType === "FREE"}
              onChange={() => setTicketType("FREE")}
            />{" "}
            Free
          </label>
          <label>
            <input
              type="radio"
              name="ticketType"
              checked={ticketType === "PAID"}
              onChange={() => setTicketType("PAID")}
            />{" "}
            Paid
          </label>

          {ticketType === "PAID" && (
            <>
              <label style={{ marginLeft: "1.5rem" }}>
                Price (£)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  style={{ marginLeft: 8, width: 120 }}
                />
              </label>
              <label style={{ marginLeft: "1rem" }}>
                <input
                  type="checkbox"
                  checked={feesIncluded}
                  onChange={e => setFeesIncluded(e.target.checked)}
                />{" "}
                Price includes booking fee
              </label>
            </>
          )}
        </div>
      </section>

      <section style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Seating</h2>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <input
              type="radio"
              name="seatingType"
              checked={seatingType === "UNALLOCATED"}
              onChange={() => setSeatingType("UNALLOCATED")}
            />{" "}
            Unallocated (General Admission)
          </label>
          <label>
            <input
              type="radio"
              name="seatingType"
              checked={seatingType === "ALLOCATED"}
              onChange={() => setSeatingType("ALLOCATED")}
            />{" "}
            Allocated (Choose seats on a map)
          </label>

          {seatingType === "UNALLOCATED" && (
            <label style={{ marginLeft: "2rem" }}>
              Capacity
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value || 0))}
                style={{ marginLeft: 8, width: 120 }}
              />
            </label>
          )}
        </div>

        {showAllocatedOptions && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <label>
                Venue ID
                <input
                  type="text"
                  placeholder="e.g. venue-123"
                  value={venueId}
                  onChange={e => setVenueId(e.target.value)}
                  style={{ marginLeft: 8 }}
                />
              </label>
              <Link to={`/events/${showId}/seating-map-builder?venueId=${encodeURIComponent(venueId || "")}`}>
                Open Seating Map Builder
              </Link>
            </div>

            <MapSuggestions
              maps={maps}
              selectedMapId={selectedMapId}
              onSelect={setSelectedMapId}
            />

            {selectedMap && (
              <p style={{ marginTop: "0.5rem" }}>
                Selected map: <strong>{selectedMap.name}</strong>{" "}
                ({selectedMap.rows}×{selectedMap.cols})
              </p>
            )}
          </div>
        )}
      </section>

      <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
        <button onClick={saveAndContinue}>Save Ticket Settings</button>
        <Link to={`/events/${showId}`}>Cancel</Link>
      </div>
    </main>
  );
}

function MapSuggestions({
  maps,
  selectedMapId,
  onSelect
}: {
  maps: SeatingMap[];
  selectedMapId: string;
  onSelect: (id: string) => void;
}) {
  if (!maps?.length) {
    return (
      <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#fafafa", borderRadius: 8 }}>
        <p><strong>No saved seating maps found for this venue.</strong></p>
        <p>Build a new map or choose a different venue.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p><strong>Suggested seating maps for this venue</strong></p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "0.75rem"
      }}>
        {maps.map(m => (
          <label key={m.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem" }}>
            <input
              type="radio"
              name="seatingMap"
              checked={selectedMapId === m.id}
              onChange={() => onSelect(m.id)}
            />{" "}
            <strong>{m.name}</strong>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              {m.summary || `${m.rows} rows × ${m.cols} cols`}
              <br />
              Updated: {new Date(m.updatedAt).toLocaleDateString("en-GB")}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
