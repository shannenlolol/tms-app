import { Router } from "express";
import { login, logout, check, refresh } from "../controllers/auth.controller.js";
import { ensureAuth } from "../middleware/jwt.js";

const router = Router();

router.post("/auth", login);       // <-- POST /api/auth
router.get("/check", ensureAuth, check);
router.get("/auth/refresh", refresh); 
router.post("/logout", logout);
router.get("/logout", logout);

export default router;
