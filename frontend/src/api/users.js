// src/api/users.js
import http from "./client";

export const getCurrentUser = async () => {
  const { data } = await http.get("/users/current");
  return data;
};

export const updateCurrentUser = async (payload) => {
  const { data } = await http.put("/users/current", payload);
  return data;
};

// (optional admin endpoints you already have on backend)
export const getUsers = async () => (await http.get("/users")).data;
export const createUser = async (body) => (await http.post("/users", body)).data;
export const updateUser = async (id, body) => (await http.put(`/users/${id}`, body)).data;
export const toggleActive = async (id, body) =>
  (await http.patch(`/users/${id}/active`, body)).data;
