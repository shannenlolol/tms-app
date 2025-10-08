// backend/src/app.js
import express from "express";
import session from "express-session";
import cors from "cors";
import "dotenv/config";

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

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);

// Secure cookies in HTTPS; SameSite depends on whether origins differ
const crossSite = true; // frontend on different origin (Vite dev) -> cross-site
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // if frontend is on a different origin, you MUST use SameSite 'none' + secure cookies
      sameSite: crossSite ? "none" : "lax",
      secure: crossSite ? true : (NODE_ENV === "production"), // secure cookies on HTTPS
      maxAge: 30 * 60 * 1000, // 30 mins
    },
  })
);

// All APIs under /api
app.use("/api", authRoutes);
app.use("/api", usersRoutes);
app.use("/api/user-groups", groupRoutes);
app.use("/api/users", selfRoutes); // exposes /api/users/current (GET, PUT)

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));
