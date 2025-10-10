// backend/src/app.js
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import { ensureAuth } from "./middleware/jwt.js"; // adjust path if different

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import groupRoutes from "./routes/groups.routes.js";
import selfRoutes from "./routes/self.routes.js";

export const app = express();

const ORIGIN = process.env.FRONTEND_ORIGIN || "https://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";

// If you’ll run behind a reverse proxy (nginx/caddy) in prod:
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);

// Secure cookies in HTTPS; SameSite depends on whether origins differ
const crossSite = true; // frontend on different origin (Vite dev) -> cross-site


// All APIs under /api
// Auth endpoints (public for login, refresh, logout; /check is protected inside the router):
//   POST /api/auth            -> login
//   GET  /api/auth/refresh    -> issue new access token from refresh cookie (NO ensureAuth here)
//   GET  /api/auth/check      -> verify access token (router applies ensureAuth for this one)
//   POST /api/auth/logout     -> revoke refresh (e.g., clear cookie)
app.use("/api/auth", authRoutes);

// “Current user” (the authenticated user’s own profile):
//   GET /api/current          -> fetch my profile
//   PUT /api/current          -> update my profile (e.g., email/password)
app.use("/api/current", ensureAuth, selfRoutes);

// Admin users collection:
//   GET    /api/users         -> list users
//   POST   /api/users         -> create user
//   PUT    /api/users/:id     -> update user by id
//   PATCH  /api/users/:id/active -> enable/disable account
app.use("/api/users", ensureAuth, usersRoutes);

// Groups:
//   GET  /api/groups          -> list groups
//   POST /api/groups          -> create group
app.use("/api/groups", ensureAuth, groupRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));
