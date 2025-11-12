import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /bootstrap/admin
 * Creates or updates an admin user with the provided email/password.
 * Body: { email: string, password: string, name?: string }
 */
router.post("/admin", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const upserted = await prisma.user.upsert({
    where: { email: String(email) },
    update: {
      name: name ?? undefined,
      role: "admin",
      passwordHash
    },
    create: {
      email: String(email),
      name: name ?? null,
      role: "admin",
      passwordHash
    },
    select: { id: true, email: true, name: true, role: true }
  });

  return res.json(upserted);
});

export default router;