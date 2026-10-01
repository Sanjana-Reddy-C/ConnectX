import { Response } from 'express';
import { db } from '../services/db.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getWorkspaces(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const workspaces = await db.getWorkspacesForUser(userId);
    return res.json({ workspaces });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve workspaces' });
  }
}

export async function createWorkspace(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const workspace = await db.createWorkspace(name, description || '', userId);
    return res.status(201).json({ workspace });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create workspace' });
  }
}

export async function joinWorkspace(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

    const workspace = await db.joinWorkspaceByInvite(inviteCode, userId);
    if (!workspace) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }
    return res.json({ workspace });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to join workspace' });
  }
}

export async function addChannel(req: AuthRequest, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Channel name is required' });

    const channel = await db.addChannel(workspaceId, name);
    if (!channel) return res.status(404).json({ error: 'Workspace not found' });

    return res.status(201).json({ channel });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create channel' });
  }
}
