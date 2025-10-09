import jwt from "jsonwebtoken";

/** Signers */
export function makeAccessToken(user) {
  // keep payload tiny; put only what you need on every request
  return jwt.sign({ sub: user.id, username: user.username }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_TTL || "15m",
  });
}
export function makeRefreshToken(user) {
  return jwt.sign({ sub: user.id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_TTL || "7d",
  });
}

/** Middlewares */
export function ensureAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing Authorization Bearer token" });

  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}

/** Helpers for refresh cookie (HttpOnly) */
export function setRefreshCookie(res, refreshToken) {
  res.cookie("rt", refreshToken, {
    httpOnly: true,
    secure: true,        // you’re on HTTPS localhost; keep true in prod
    sameSite: "none",
    path: "/api/auth/refresh",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days (matches default)
  });
}



export function clearRefreshCookie(res) {
  res.clearCookie("rt", { path: "/api/auth/refresh" });
}
