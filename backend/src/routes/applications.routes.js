import { Router } from "express";
import { ensureAuth } from "../middleware/jwt.js";
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../controllers/applications.controller.js";

const router = Router();

// Protect all endpoints
router.use(ensureAuth);

/** GET /api/applications */
router.get("/", listApplications);

/** POST /api/applications */
router.post("/", createApplication);

/** PUT /api/applications/:acronym */
router.put("/:acronym", updateApplication);

/** DELETE /api/applications/:acronym (optional) */
router.delete("/:acronym", deleteApplication);

export default router;
