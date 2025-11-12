import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, API_BASE } from "../api";

export default function Logout() {
  const nav = useNavigate();

  useEffect(() => {
    try { localStorage.removeItem("token"); } catch {}
    api.logout()
      .catch(() => {})
      .finally(() => {
        // Prefer a hard redirect to the backend login (works in dev & prod)
        window.location.href = `${API_BASE}/auth/login`;
        // Fallback in case env is odd:
        setTimeout(() => nav("/auth/login", { replace: true }), 1200);
      });
  }, [nav]);

  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", padding: "1rem" }}>
      <h1>Signing you out…</h1>
      <p>Clearing your session and redirecting.</p>
    </main>
  );
}