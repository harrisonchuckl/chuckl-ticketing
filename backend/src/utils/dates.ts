// src/utils/dates.ts
export function formatDateTimeUK(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  // e.g. 14/03/2026, 19:30
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}
