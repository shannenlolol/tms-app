// src/api/users.js
//  * Users API helpers: current user + admin CRUD.
//  * Endpoints: GET /users/current, GET/POST /users, PUT /users/:username
//  * Exports: getCurrentUser(), updateCurrentUser(), getUsers(), createUser(), updateUser()

import http from "./client";

// GET /api/current  -> current profile
export const getCurrentUser = async () => {
  const { data } = await http.get("/current");
  return data;
};

// PUT /api/current -> update email and/or password
export const updateCurrentUser = async (payload) =>
  (await http.put("/current", payload)).data;

// Admin endpoints
export const getUsers = async () => (await http.get("/users")).data;
export const createUser = async (body) => (await http.post("/users", body)).data;
export const updateUser = async (username, body) => (await http.put(`/users/${username}`, body)).data;
export const checkGroup = async (username, usergroup) =>
  (await http.post("/users/check-group", { username, usergroup })).data;