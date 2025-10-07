import { Router } from "express";
import { login, logout, adminhome } from "../controllers/auth.controller.js";

const router = Router();

router.post("/auth", login);       // <-- POST /api/auth
router.get("/adminhome", adminhome);
router.post("/logout", logout);
router.get("/logout", logout);

export default router;
