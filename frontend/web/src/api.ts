export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {})
    },
    ...opts
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Events
  createShow: (payload: { title: string; venueId: string; date: string; description?: string | null }) =>
    request<{ ok: true; showId: string }>("/events", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  getShow: (id: string) => request<{ ok: true; show: any }>(`/events/${id}`),

  // Admin show details
  getAdminShow: (id: string) =>
    request<{
      ok: true;
      item: {
        id: string;
        title: string | null;
        venue: { id: string; name: string; city: string | null; capacity: number | null } | null;
        venueId: string | null;
        usesAllocatedSeating: boolean | null;
        showCapacity: number | null;
        activeSeatMapId: string | null;
        ticketTypes: Array<{
          id: string;
          name: string;
          pricePence: number;
          bookingFeePence: number | null;
          available: number | null;
        }>;
      };
    }>(`/admin/shows/${id}`),

  updateShow: (id: string, payload: {
    venueId?: string | null;
    usesAllocatedSeating?: boolean;
    showCapacity?: number | null;
    activeSeatMapId?: string | null;
  }) =>
    request<{ ok: true; id: string }>(`/admin/shows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),

  createTicketType: (
    showId: string,
    payload: { name: string; pricePence: number; bookingFeePence?: number; available: number }
  ) =>
    request<{ ok: true; ticketType: { id: string } }>(`/admin/shows/${showId}/ticket-types`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  updateTicketType: (
    ticketTypeId: string,
    payload: { name?: string; pricePence?: number; bookingFeePence?: number; available?: number }
  ) =>
    request<{ ok: true; ticketType: { id: string } }>(`/admin/ticket-types/${ticketTypeId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  // Admin Venues search (for the dropdown)
  searchVenues: (q = "") =>
    request<{ ok: true; items: Array<{ id: string; name: string; city: string | null }> }>(
      `/admin/venues?q=${encodeURIComponent(q)}`
    ),

  // Seating map suggestions
  listSeatingMaps: (venueId: string, limit = 5) =>
    request<{ ok: true; maps: Array<{ id: string; name: string; summary: string | null; rows: number; cols: number; updatedAt: string }> }>(
      `/venues/${venueId}/seating-maps?limit=${limit}`
    ),

  // Logout (server redirects you)
  logout: () => fetch(`${API_BASE}/auth/logout`, { credentials: "include" }),
};
