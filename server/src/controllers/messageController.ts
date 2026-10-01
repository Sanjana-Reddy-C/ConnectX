import { Response } from 'express';
import { db } from '../services/db.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getChannelMessages(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const messages = await db.getChannelMessages(channelId);
    return res.json({ messages });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

export async function getDirectMessages(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const messages = await db.getDirectMessages(userId, targetUserId);
    // Mark incoming messages as read
    await db.markMessagesAsRead(targetUserId, userId);
    return res.json({ messages });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch direct messages' });
  }
}

export async function getUnreadMessages(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const unread = await db.getUnreadMessagesForUser(userId);
    return res.json({ unreadMessages: unread, count: unread.length });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch unread messages' });
  }
}

export async function postMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name || 'Unknown User';
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { content, channelId, recipientId, workspaceId } = req.body;
    if (!content) return res.status(400).json({ error: 'Content cannot be empty' });

    const msg = await db.saveMessage({
      content,
      senderId: userId,
      senderName: userName,
      channelId,
      recipientId,
      workspaceId,
    });

    return res.status(201).json({ message: msg });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save message' });
  }
}
