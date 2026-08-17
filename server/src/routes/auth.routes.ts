import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import {
  authenticate,
  AuthRequest,
} from "../middleware/auth.middleware";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    message: "Auth Routes Working 🚀",
  });
});

router.post("/register", authController.register);

router.post("/login", authController.login);

router.get(
  "/profile",
  authenticate,
  (req: AuthRequest, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  }
);

export default router;