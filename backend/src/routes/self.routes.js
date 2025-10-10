import { Router } from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { getCurrentUser, updateCurrentUser } from "../controllers/self.controller.js";

const r = Router();

// GET current user
r.get("/", ensureAuth, getCurrentUser);      // GET /api/current

// PUT current user (email and/or password)
r.put("/", ensureAuth, updateCurrentUser);   // PUT /api/current

export default r;
