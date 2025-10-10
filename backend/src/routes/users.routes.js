import { Router } from "express";
import * as users from "../controllers/users.controller.js"; // note: * as users
import { ensureAuth } from "../middleware/jwt.js";

const router = Router();

router.get("/", users.list);                    // GET    /api/users
router.post("/", users.create);                 // POST   /api/users
router.put("/:id", users.update);               // PUT    /api/users/:id
router.patch("/:id/active", users.patchActive); // PATCH /api/users/:id/active

export default router;
