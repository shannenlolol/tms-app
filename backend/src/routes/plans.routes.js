// backend/src/routes/plans.routes.js
import express from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { createPlan, listPlans } from "../controllers/plans.controller.js";

const router = express.Router();

router.get("/", ensureAuth, listPlans);
router.post("/", ensureAuth, createPlan);
// router.post("/:planName/attach", ensureAuth, attachPlanToApp);

export default router;
