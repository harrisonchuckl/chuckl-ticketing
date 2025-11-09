// backend/src/routes/logout.ts
import { Router } from 'express';

const router = Router();

/**
 * GET /auth/logout
 * Clears all cookies (belt & braces) and redirects to the login page.
 */
router.get('/logout', (req, res) => {
  try {
    // Clear known cookie names if you use a specific one
    res.clearCookie('session', { path: '/' });
    res.clearCookie('token', { path: '/' });

    // Also clear any remaining cookies just in case
    if (req.cookies) {
      for (const k of Object.keys(req.cookies)) {
        res.clearCookie(k, { path: '/' });
      }
    }
  } catch {
    // ignore
  }
  // Redirect to your existing login route (adjust if yours differs)
  res.redirect('/auth/login');
});

export default router;
