import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

/**
 * One-time admin bootstrap endpoint.
 * Protect with BOOTSTRAP_SECRET (query ?key=...).
 */
router.get("/", async (req, res) => {
  try {
    // Optional safety key
    const mustHaveKey = process.env.BOOTSTRAP_SECRET;
    if (mustHaveKey && req.query.key !== mustHaveKey) {
      return res.status(403).json({ error: "forbidden" });
    }

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({ error: "ADMIN_EMAIL or ADMIN_PASSWORD missing" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: "admin" },
      create: {
        email,
        name: "Administrator",
        role: "admin",
        passwordHash,
      },
    });

    return res.json({ ok: true, userId: user.id, email: user.email });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "bootstrap_failed" });
  }
});

export default router;
