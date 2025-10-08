import { Router } from "express";
import * as users from "../controllers/users.controller.js"; // note: * as users
import { ensureAuth } from "../middleware/jwt.js";

const router = Router();

router.get("/users", ensureAuth, users.list);
router.post("/users", ensureAuth, users.create);
router.put("/users/:id", ensureAuth, users.update);
router.patch("/users/:id/active", ensureAuth, users.patchActive);

export default router;
