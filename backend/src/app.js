import express from "express";
import session from "express-session";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";

export const app = express();

const ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({ origin: ORIGIN, credentials: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 30 * 60 * 1000 },
  })
);

// All APIs under /api
app.use("/api", authRoutes);
app.use("/api", usersRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
