// routes/users.routes.js
//  * Admin-style user management routes.
//  * GET/POST /api/users, PUT /api/users/:username
 
import { Router } from "express";
import * as users from "../controllers/users.controller.js"; // note: * as users
import { ensureAuth } from "../middleware/jwt.js";

const router = Router();

router.get("/", ensureAuth, users.list);            // GET    /api/users
router.post("/", ensureAuth, users.create);         // POST   /api/users
router.put("/:username", ensureAuth, users.update); // PUT    /api/users/:username

export default router;
