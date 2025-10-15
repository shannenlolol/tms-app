// src/api/users.js
//  * Users API helpers: current user + admin CRUD.
//  * Endpoints: GET /users/current, GET/POST /users, PUT /users/:id, PATCH /users/:id/active.
//  * Exports: getCurrentUser(), updateCurrentUser(), getUsers(), createUser(), updateUser(), toggleActive().

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
export const updateUser = async (id, body) => (await http.put(`/users/${id}`, body)).data;
export const toggleActive = async (id, body) =>
  (await http.patch(`/users/${id}/active`, body)).data;
