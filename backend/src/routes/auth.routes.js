// routes/auth.routes.js
//  * Authentication routes: login, token refresh (via cookie), logout, and an authenticated health/check.
//  * POST /api/auth, GET /api/auth/refresh, POST /api/auth/logout, GET /api/auth/check (requires ensureAuth).
import { Router } from "express";
import { login, logout, check, refresh } from "../controllers/auth.controller.js";
import { ensureAuth } from "../middleware/jwt.js";

const router = Router();

router.post("/login", login);                 // POST /api/auth
router.get("/check", ensureAuth, check); // GET  /api/auth/check
router.get("/refresh", refresh);         // GET  /api/auth/refresh 
router.post("/logout", logout);          // POST /api/auth/logout

export default router;
