// backend/src/routes/calendar-ics.ts
import { Router } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

/**
 * GET /calendar/event/:id.ics
 * Generates a simple ICS file for a show.
 */
router.get('/event/:id.ics', async (req, res) => {
  try {
    const id = String(req.params.id);
    const show = await prisma.show.findUnique({
      where: { id },
      include: { venue: true },
    });
    if (!show) return res.status(404).send('Not found');

    const dt = new Date(show.date);
    const dtStart = toICSDate(dt);
    const dtEnd = toICSDate(new Date(dt.getTime() + 2 * 60 * 60 * 1000)); // +2h default

    const venue = show.venue;
    const loc = [venue?.name, venue?.city, venue?.postcode].filter(Boolean).join(', ');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Chuckl Ticketing//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${show.id}@chuckl`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(show.title)}`,
      `DESCRIPTION:${escapeICS(show.description || '')}`,
      `LOCATION:${escapeICS(loc)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-${show.id}.ics"`);
    res.send(ics);
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to generate calendar');
  }
});

function pad(n: number){ return n < 10 ? '0'+n : ''+n; }
function toICSDate(d: Date){
  return d.getUTCFullYear()
    + pad(d.getUTCMonth()+1)
    + pad(d.getUTCDate())
    + 'T'
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds())
    + 'Z';
}
function escapeICS(s: string){
  return s.replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

export default router;
