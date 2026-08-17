import { Router } from "express";
import * as workspaceController from "../controllers/workspace.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  workspaceController.createWorkspace
);

router.get(
  "/",
  authenticate,
  workspaceController.getWorkspaces
);

router.post(
  "/:workspaceId/members",
  authenticate,
  workspaceController.addMember
);

router.get(
  "/:workspaceId/members",
  authenticate,
  workspaceController.getMembers
);

export default router;