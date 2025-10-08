import { Router } from "express";
import pool from "../models/db.js";
import bcrypt from "bcrypt";
import { ensureAuth } from "../middleware/jwt.js";
import { getCurrentUser, updateCurrentUser } from "../controllers/self.controller.js";

const r = Router();

// GET current user
r.get("/current", ensureAuth, getCurrentUser);

// PUT current user (email and/or password)
r.put("/current", ensureAuth, updateCurrentUser);

export default r;
