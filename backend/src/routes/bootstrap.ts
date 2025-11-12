import { Router, Request, Response } from "express";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /bootstrap?key=YOUR_SECRET
 * Creates/updates the initial admin user.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const key = String(req.query.key ?? "");
    const secret = process.env.BOOTSTRAP_KEY ?? "";

    // Hide if incorrect key or no secret configured
    if (!secret || key !== secret) {
      return res.status(404).json({ error: "Not found" });
    }

    const email = process.env.BOOTSTRAP_EMAIL ?? "admin@chuckl.co.uk";
    const password = process.env.BOOTSTRAP_PASSWORD ?? "change-me";
    const name = process.env.BOOTSTRAP_NAME ?? "Admin";

    // organiser split in basis points (nullable)
    const splitStr = process.env.BOOTSTRAP_ORGANISER_SPLIT_BPS?.trim();
    const organiserSplitBps =
      splitStr && splitStr !== "" ? parseInt(splitStr, 10) : null;

    const salt = await bcrypt.genSalt(10);           // <- string salt
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        organiserSplitBps,
        role: "admin",
      },
      create: {
        email,
        name,
        passwordHash,
        organiserSplitBps,
        role: "admin",
      },
    });

    return res.json({
      ok: true,
      userId: user.id,
      email: user.email,
      role: user.role,
      organiserSplitBps: user.organiserSplitBps,
    });
  } catch (err) {
    console.error("bootstrap error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;