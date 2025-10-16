// routes/self.routes.js
//  * Current-user endpoints behind ensureAuth.
//  * GET /api/current → profile; PUT /api/current → update email and/or password.
 
import { Router } from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { getCurrentUser, updateCurrentUser } from "../controllers/self.controller.js";

const r = Router();

r.get("/", ensureAuth, getCurrentUser);      // GET /api/current
r.put("/", ensureAuth, updateCurrentUser);   // PUT /api/current

export default r;
