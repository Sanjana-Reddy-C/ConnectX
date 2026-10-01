import { Response } from "express";
import * as workspaceService from "../services/workspace.service";
import { AuthRequest } from "../middleware/auth.middleware";

export const createWorkspace = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const workspace = await workspaceService.createWorkspace(
      req.user.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getWorkspaces = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const workspaces =
      await workspaceService.getUserWorkspaces(
        req.user.userId
      );

    res.json({
      success: true,
      data: workspaces,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addMember = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { workspaceId } = req.params;
    const { email } = req.body;

    const member =
      await workspaceService.addWorkspaceMember(
        workspaceId,
        req.user.userId,
        email
      );

    res.status(201).json({
      success: true,
      message: "Member added successfully",
      data: member,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMembers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const { workspaceId } = req.params;

    const members =
      await workspaceService.getWorkspaceMembers(
        workspaceId
      );

    res.json({
      success: true,
      data: members,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};