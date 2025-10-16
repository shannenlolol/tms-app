// routes/groups.routes.js
//  * Simple group catalogue: list all group names, create a new group.
//  * GET /api/groups, POST /api/groups (handles duplicate names gracefully).

import { Router } from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { createGroup, listGroups } from "../controllers/groups.controller.js";

const r = Router();

r.get("/", ensureAuth, listGroups);  // GET    /api/groups 
r.post("/",ensureAuth, createGroup); // POST   /api/groups 

export default r;
