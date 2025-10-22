// src/api/client.js
//  * Preconfigured Axios instance for all API calls.
//  * Attaches in-memory access token; on 401, calls /auth/refresh and retries queued requests.
//  * Central place for baseURL and withCredentials.

// src/api/client.js
import axios from "axios";

export const http = axios.create({
  baseURL: "https://localhost:3000/api",
  withCredentials: true,
});

let ACCESS = null;
export function setAccessToken(t) { ACCESS = t || null; }
export function getAccessToken() { return ACCESS; }

// Attach bearer to non-refresh requests if we have one
http.interceptors.request.use((config) => {
  const url = config.url || "";
  const isRefresh = url.endsWith("/auth/refresh");
  if (!isRefresh && ACCESS) {
    config.headers.Authorization = `Bearer ${ACCESS}`;
  }
  return config;
});

let isRefreshing = false;
let waiters = [];

function onRefreshed(newAccess) {
  waiters.forEach((resolve) => resolve(newAccess));
  waiters = [];
}

function addWaiter(cb) {
  waiters.push(cb);
}

const EXCLUDE_401_REFRESH = [
  "/auth",          // if your login route is POST /api/auth
  "/auth/login",    // add this if your route is /api/auth/login
  "/auth/refresh",
];

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";

    // 1) Never try to refresh for these endpoints
    if (EXCLUDE_401_REFRESH.some((p) => url.endsWith(p))) {
      // mark refresh errors as silent for any global toast layer
      if (url.endsWith("/auth/refresh") && status === 401) {
        err._silent = true;
      }
      return Promise.reject(err);
    }

    // 2) Only attempt refresh if we actually have an access token already
    //    (i.e., user was logged in). On the login page there won’t be one.
    if (status === 401 && getAccessToken()) {
      const original = err.config;

      // If a refresh is in-flight, queue this request until it finishes
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addWaiter((newAccess) => {
            if (!newAccess) return reject(err);
            original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
            resolve(http(original));
          });
        });
      }

      // Start a refresh
      isRefreshing = true;
      try {
        const { data, status: s } = await http.get("/auth/refresh", {
          // Use base client but avoid recursive interceptor issues:
          // NOTE: because this is the same instance, we exclude via the EXCLUDE list above.
          withCredentials: true,
          validateStatus: (st) => (st >= 200 && st < 300) || st === 401,
        });

        const newAccess = s === 401 ? null : data?.accessToken || null;
        if (newAccess) {
          setAccessToken(newAccess);
          onRefreshed(newAccess);
          // retry original request with new token
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
          return http(original);
        } else {
          // refresh failed — propagate 401
          onRefreshed(null);
          return Promise.reject(err);
        }
      } finally {
        isRefreshing = false;
      }
    }

    // 3) For any other case, just bubble up
    return Promise.reject(err);
  }
);


export default http;
