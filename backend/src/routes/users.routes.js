// routes/users.routes.js
//  * Admin-style user management routes.
//  * GET/POST /api/users, PUT /api/users/:username, PATCH /api/users/:username/active.
 
import { Router } from "express";
import * as users from "../controllers/users.controller.js"; // note: * as users
import { ensureAuth } from "../middleware/jwt.js";

const router = Router();

router.get("/", users.list);                    // GET    /api/users
router.post("/", users.create);                 // POST   /api/users
router.put("/:username", users.update);               // PUT    /api/users/:username
router.patch("/:username/active", users.patchActive); // PATCH /api/users/:username/active

export default router;
