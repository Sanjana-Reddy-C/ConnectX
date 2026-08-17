import prisma from "../config/prisma";

interface WorkspaceInput {
  name: string;
  description?: string;
}

export const createWorkspace = async (
  userId: string,
  data: WorkspaceInput
) => {
  const workspace = await prisma.workspace.create({
    data: {
      name: data.name,
      description: data.description,
      ownerId: userId,
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId,
      role: "OWNER",
    },
  });

  return workspace;
};

export const getUserWorkspaces = async (userId: string) => {
  return await prisma.workspaceMember.findMany({
    where: {
      userId,
    },
    include: {
      workspace: true,
    },
  });
};

export const addWorkspaceMember = async (
  workspaceId: string,
  userId: string,
  memberEmail: string
) => {
  const user = await prisma.user.findUnique({
    where: {
      email: memberEmail,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const existingMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      },
    },
  });

  if (existingMember) {
    throw new Error("User is already a workspace member");
  }

  return await prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId: user.id,
      role: "MEMBER",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const getWorkspaceMembers = async (
  workspaceId: string
) => {
  return await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};