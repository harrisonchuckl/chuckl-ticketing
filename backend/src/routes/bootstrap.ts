import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /bootstrap/admin
 * Body: { email: string, password: string, name?: string }
 */
router.post("/admin", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(String(password), salt);

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
