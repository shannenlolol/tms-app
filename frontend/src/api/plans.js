// src/api/plans.js
//  * Plans API helpers: list plans and create a new plan.
//  * Uses the shared Axios client; endpoints: GET /plans, POST /plans.
//  * Exports: getPlans(appAcronym?), createPlan(payload).

import http from "./client";

// GET -> [{ Plan_MVP_name, Plan_app_Acronym, Plan_startDate, Plan_endDate }, ...]
// Optional filter by application acronym via `?app=ACR`
export const getPlans = async (appAcronym) =>
  (await http.get("/plans", { params: appAcronym ? { app: appAcronym } : undefined })).data;

// POST { Plan_MVP_name, Plan_app_Acronym, Plan_startDate?, Plan_endDate? }
// -> { Plan_MVP_name, Plan_app_Acronym, Plan_startDate, Plan_endDate }
export const createPlan = async ({ Plan_MVP_name, Plan_app_Acronym, Plan_startDate, Plan_endDate }) =>
  (await http.post("/plans", { Plan_MVP_name, Plan_startDate, Plan_endDate })).data;
