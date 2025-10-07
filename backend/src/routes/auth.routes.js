import { Router } from "express";
import { login, logout, check } from "../controllers/auth.controller.js";

const router = Router();

router.post("/auth", login);       // <-- POST /api/auth
router.get("/check", check);
router.post("/logout", logout);
router.get("/logout", logout);

export default router;
