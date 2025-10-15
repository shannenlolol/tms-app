// src/api/client.js
//  * Preconfigured Axios instance for all API calls.
//  * Attaches in-memory access token; on 401, calls /auth/refresh and retries queued requests.
//  * Central place for baseURL and withCredentials.

import axios from "axios";

/** In-memory access token */
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t || null; };
export const getAccessToken = () => accessToken;

/** One shared Axios instance */
const http = axios.create({
  baseURL: "https://localhost:3000/api",
  withCredentials: true, // needed for refresh cookie calls
});

// Attach Authorization
http.interceptors.request.use((config) => {
  config.headers ||= {};
  const at = getAccessToken();
  if (at) config.headers.Authorization = `Bearer ${at}`;
  return config;
});

// 401 -> try refresh once, then retry original
let isRefreshing = false;
let queue = [];

function flushQueue(newToken) {
  queue.forEach(({ resolve, reject, original }) => {
    original.headers ||= {};
    if (newToken) {
      original.headers.Authorization = `Bearer ${newToken}`;
      http(original).then(resolve).catch(reject);
    } else {
      reject(new Error("Unauthorised"));
    }
  });
  queue = [];
}

http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status;
    const original = error.config || {};
    if (status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push({ resolve, reject, original }));
    }

    try {
      isRefreshing = true;
      const { data } = await axios.get("https://localhost:3000/api/auth/refresh", {
        withCredentials: true,
      });
      const newToken = data?.accessToken || null;
      setAccessToken(newToken);
      flushQueue(newToken);

      original.headers ||= {};
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
      return Promise.reject(error);
    } catch (e) {
      setAccessToken(null);
      flushQueue(null);
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default http;
