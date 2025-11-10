// src/api/client.js
//  * Preconfigured Axios instance (cookie-based auth).
//  * NO bearer tokens; browser sends HttpOnly cookies automatically.
//  * On 401 (for non-auth endpoints), call /auth/refresh once and retry queued requests.
//  * Central place for baseURL and withCredentials.

import axios from "axios";

export const http = axios.create({
  baseURL: "https://localhost:3000/api",
  withCredentials: true, // <-- send cookies
});

// --- Optional: CSRF for write requests (double-submit cookie pattern) ---
function readCookie(name) {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

http.interceptors.request.use((config) => {
  // Remove any leftover Authorization header usage (paranoia)
  if (config?.headers?.Authorization) delete config.headers.Authorization;

  // If you implemented a readable CSRF cookie (e.g., "csrf_at"), mirror it in a header for writes.
  const isWrite = /post|put|patch|delete/i.test(config.method || "");
  if (isWrite) {
    const csrf = readCookie("csrf_at");
    if (csrf) config.headers["x-csrf"] = csrf;
  }
  return config;
});

// --- 401 → refresh once logic (stampede control) ---
let isRefreshing = false;
let waiters = [];

function queueWaiter(cb) {
  waiters.push(cb);
}
function resolveWaiters(ok) {
  waiters.forEach((cb) => cb(ok));
  waiters = [];
}

const EXCLUDE_401_REFRESH = [
  "/auth",
  "/auth/login",
  "/auth/refresh",
  "/logout",
];

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const original = err?.config || {};
    const url = original?.url || "";

    // Never try to refresh for these endpoints
    if (EXCLUDE_401_REFRESH.some((p) => url.endsWith(p))) {
      // mark refresh errors as silent for any global toast layer
      if (url.endsWith("/auth/refresh") && status === 401) err._silent = true;
      return Promise.reject(err);
    }

    // Only attempt a refresh on 401, and avoid infinite loops
    if (status === 401 && !original.__isRetry) {
      if (isRefreshing) {
        // Wait for the in-flight refresh to complete, then retry if it succeeded
        return new Promise((resolve, reject) => {
          queueWaiter((ok) => {
            if (!ok) return reject(err);
            resolve(http({ ...original, __isRetry: true }));
          });
        });
      }

      // Start a refresh
      isRefreshing = true;
      try {
        const resp = await http.get("/auth/refresh", {
          // Same instance is OK because we exclude it above
          withCredentials: true,
          validateStatus: (s) => (s >= 200 && s < 300) || s === 401,
        });

        const ok = resp.status >= 200 && resp.status < 300;
        resolveWaiters(ok);
        if (ok) {
          // "at" cookie is renewed server-side; retry original without any header tweaks
          return http({ ...original, __isRetry: true });
        }
        // Refresh failed → propagate the original 401
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    // Otherwise, bubble up
    return Promise.reject(err);
  }
);

export default http;
