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