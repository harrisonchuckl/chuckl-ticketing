// src/admin/api/ticketsSeatmapsApi.ts

export type TicketType = {
  id: string;
  showId: string;
  name: string;
  pricePence: number;
  available: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SeatMap = {
  id: string;
  showId: string;
  venueId: string | null;
  name: string;
  isDefault: boolean;
  version: number;
  layout: any | null;
  createdAt?: string;
  updatedAt?: string;
  seats?: any[];
  zones?: any[];
};

export type ShowSummary = {
  id: string;
  title: string;
  startsAt: string;
  venueName?: string | null;
  venueId?: string | null;
};

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    // 404 is treated as "no data" by some callers
    const text = await res.text().catch(() => "");
    let message = `Request failed with status ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) message = parsed.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ---- Ticket types ----

export async function fetchTicketTypes(showId: string): Promise<TicketType[]> {
  const res = await fetch(`/admin/shows/${showId}/ticket-types`, {
    credentials: "include",
  });

  if (res.status === 404) {
    // No ticket types yet
    return [];
  }

  const data = await handleJson<{ ok?: boolean; ticketTypes?: TicketType[]; [k: string]: any }>(res);
  return data.ticketTypes ?? [];
}

export async function createTicketType(
  showId: string,
  payload: { name: string; pricePence: number; available?: number | null }
): Promise<TicketType> {
  const res = await fetch(`/admin/shows/${showId}/ticket-types`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ ok?: boolean; ticketType: TicketType }>(res);
  return data.ticketType;
}

export async function updateTicketType(
  id: string,
  payload: Partial<{ name: string; pricePence: number; available: number | null }>
): Promise<TicketType> {
  const res = await fetch(`/admin/ticket-types/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleJson<{ ok?: boolean; ticketType: TicketType }>(res);
  return data.ticketType;
}

export async function deleteTicketType(id: string): Promise<void> {
  const res = await fetch(`/admin/ticket-types/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to delete ticket type (${res.status})`);
  }
}

// ---- Shows / seat maps ----

export async function fetchShow(showId: string): Promise<ShowSummary> {
  const res = await fetch(`/admin/shows/${showId}`, {
    credentials: "include",
  });
  const data = await handleJson<ShowSummary>(res);
  return data;
}

export async function fetchSeatMapsForShow(showId: string): Promise<SeatMap[]> {
  const url = `/admin/seatmaps?showId=${encodeURIComponent(showId)}`;
  const res = await fetch(url, { credentials: "include" });

  if (res.status === 404) return [];

  // your backend currently returns a raw array (not {ok: true})
  return handleJson<SeatMap[]>(res);
}

export async function simpleGenerateSeatMap(params: {
  showId: string;
  venueId?: string | null;
  name?: string;
  rows: number;
  seatsPerRow: number;
  levelLabel?: string;
}): Promise<SeatMap> {
  const res = await fetch("/admin/seatmaps/simple-generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await handleJson<{ ok?: boolean; seatMap: SeatMap }>(res);
  return data.seatMap;
}
