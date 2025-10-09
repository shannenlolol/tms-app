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
app.use("/api", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", ensureAuth, selfRoutes); // exposes /api/users/current (GET, PUT)
app.use("/api", ensureAuth, usersRoutes); 
app.use("/api/user-groups", ensureAuth, groupRoutes);


// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));
