import { Router } from "express";
import { requireAdminOrOrganiser } from "../lib/authz.js";
import { requireSiteOwner } from "../lib/owner-authz.js";

const router = Router();

router.get("/owner", requireAdminOrOrganiser, requireSiteOwner, (_req, res) => {
  const response = {
    ok: true,
    message: "Owner console endpoint ready.",
  };
  console.log("[admin-owner] response", response);
  return res.json(response);
});

export default router;
