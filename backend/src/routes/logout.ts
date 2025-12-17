// backend/src/routes/logout.ts
import { Router } from "express";

const router = Router();

/**
 * GET /auth/logout
 * Clears auth cookie and redirects to the organiser login page.
 */
router.get("/logout", (_req, res) => {
  res.clearCookie("auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  res.redirect("/admin/ui/login");
});

export default router;
