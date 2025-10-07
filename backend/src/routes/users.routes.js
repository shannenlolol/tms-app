import { Router } from "express";
import * as users from "../controllers/users.controller.js"; // note: * as users

const router = Router();

router.get("/users", users.list);
router.post("/users", users.create);
router.put("/users/:id", users.update);
router.patch("/users/:id/active", users.patchActive);

export default router;
