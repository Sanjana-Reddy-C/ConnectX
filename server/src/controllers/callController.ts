import { Request, Response } from 'express';
import { Server } from 'socket.io';

import { db } from '../services/db.js';
import {
  AuthRequest,
} from '../middleware/auth.js';

import {
  callRegistry,
} from '../services/callRegistry.js';

let io: Server | null = null;

export function setCallSocketServer(
  socketServer: Server
) {
  io = socketServer;
}

// ============================================================
// WEBRTC CONFIG
// ============================================================

export async function getWebRtcConfig(
  _req: Request,
  res: Response
) {
  const iceServers = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },
  ];

  if (process.env.TURN_URL) {
    iceServers.push({
      urls: [process.env.TURN_URL],
      ...(process.env.TURN_USERNAME
        ? { username: process.env.TURN_USERNAME }
        : {}),
      ...(process.env.TURN_PASSWORD
        ? { credential: process.env.TURN_PASSWORD }
        : {}),
    } as any);
  }

  return res.json({
    config: {
      iceServers,
    },
  });
}

// ============================================================
// FIND USER BY PHONE
// ============================================================

export async function initiateCall(
  req: Request,
  res: Response
) {
  try {
    const authReq = req as AuthRequest;

    const callerId = authReq.user?.id;

    if (!callerId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const {
      phoneNumber,
      type = 'VOICE',
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required',
      });
    }

    if (
      type !== 'VOICE' &&
      type !== 'VIDEO'
    ) {
      return res.status(400).json({
        error: 'Call type must be VOICE or VIDEO',
      });
    }

    const cleanPhone = String(phoneNumber)
      .trim()
      .replace(/[^\d+]/g, '');

    const caller =
      await db.getUserById(callerId);

    if (!caller) {
      return res.status(404).json({
        error: 'Caller account not found',
      });
    }

    const receiver =
      await db.getUserByPhone(cleanPhone);

    if (!receiver) {
      return res.status(404).json({
        error:
          'No ConnectX user is registered with this phone number',
      });
    }

    if (receiver.id === caller.id) {
      return res.status(400).json({
        error: 'You cannot call yourself',
      });
    }

    const callId =
      `call-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

    const roomId =
      `room-${callId}`;

    const call =
      callRegistry.createCall({
        callId,
        roomId,
        callerId: caller.id,
        callerName: caller.name,
        receiverId: receiver.id,
        receiverName: receiver.name,
        phoneNumber: cleanPhone,
        type,
      });

    if (io) {
      callRegistry.sendToUser(
        io,
        receiver.id,
        'incoming-call',
        {
          callId: call.callId,
          roomId: call.roomId,
          callerId: caller.id,
          callerName: caller.name,
          callerPhoneNumber:
            caller.phoneNumber || '',
          receiverId: receiver.id,
          receiverName: receiver.name,
          type: call.type,
          createdAt: call.createdAt,
        }
      );
    }

    const receiverOnline =
      callRegistry.isUserOnline(
        receiver.id
      );

    return res.status(201).json({
      success: true,

      call: {
        callId: call.callId,
        roomId: call.roomId,
        type: call.type,
        receiverId: receiver.id,
        receiverName: receiver.name,
        phoneNumber: receiver.phoneNumber,
        receiverOnline,
      },
    });
  } catch (error) {
    console.error(
      'Failed to initiate call:',
      error
    );

    return res.status(500).json({
      error: 'Failed to initiate call',
    });
  }
}

// ============================================================
// ACCEPT CALL
// ============================================================

export async function acceptCall(
  req: Request,
  res: Response
) {
  try {
    const authReq = req as AuthRequest;

    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({
        error: 'callId is required',
      });
    }

    const call =
      callRegistry.getCall(callId);

    if (!call) {
      return res.status(404).json({
        error: 'Call not found or expired',
      });
    }

    if (call.receiverId !== userId) {
      return res.status(403).json({
        error: 'You are not the receiver of this call',
      });
    }

    callRegistry.updateCall(
      callId,
      'ACCEPTED'
    );

    if (io) {
      callRegistry.sendToUser(
        io,
        call.callerId,
        'call-accepted',
        {
          callId: call.callId,
          roomId: call.roomId,
          receiverId: call.receiverId,
          receiverName: call.receiverName,
          type: call.type,
        }
      );
    }

    return res.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error(
      'Failed to accept call:',
      error
    );

    return res.status(500).json({
      error: 'Failed to accept call',
    });
  }
}

// ============================================================
// REJECT CALL
// ============================================================

export async function rejectCall(
  req: Request,
  res: Response
) {
  try {
    const authReq = req as AuthRequest;

    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { callId } = req.body;

    const call =
      callRegistry.getCall(callId);

    if (!call) {
      return res.status(404).json({
        error: 'Call not found',
      });
    }

    if (call.receiverId !== userId) {
      return res.status(403).json({
        error: 'You are not the receiver',
      });
    }

    callRegistry.updateCall(
      callId,
      'REJECTED'
    );

    if (io) {
      callRegistry.sendToUser(
        io,
        call.callerId,
        'call-rejected',
        {
          callId: call.callId,
          receiverId: call.receiverId,
          receiverName: call.receiverName,
        }
      );
    }

    callRegistry.removeCall(callId);

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      'Failed to reject call:',
      error
    );

    return res.status(500).json({
      error: 'Failed to reject call',
    });
  }
}

// ============================================================
// END CALL
// ============================================================

export async function endCall(
  req: Request,
  res: Response
) {
  try {
    const authReq = req as AuthRequest;

    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const { callId } = req.body;

    const call =
      callRegistry.getCall(callId);

    if (!call) {
      return res.status(404).json({
        error: 'Call not found',
      });
    }

    if (
      call.callerId !== userId &&
      call.receiverId !== userId
    ) {
      return res.status(403).json({
        error: 'You are not part of this call',
      });
    }

    callRegistry.updateCall(
      callId,
      'ENDED'
    );

    const otherUserId =
      call.callerId === userId
        ? call.receiverId
        : call.callerId;

    if (io) {
      callRegistry.sendToUser(
        io,
        otherUserId,
        'call-ended',
        {
          callId: call.callId,
        }
      );
    }

    callRegistry.removeCall(callId);

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      'Failed to end call:',
      error
    );

    return res.status(500).json({
      error: 'Failed to end call',
    });
  }
}

// ============================================================
// CALL LOG
// ============================================================

export async function logCall(
  req: Request,
  res: Response
) {
  try {
    const authReq = req as AuthRequest;

    const userId = authReq.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    const {
      roomId,
      type,
      status,
      duration,
      participants,
    } = req.body;

    const caller =
      await db.getUserById(userId);

    if (!caller) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const log =
      await db.logCall({
        initiatorId: userId,
        initiatorName: caller.name,
        roomId,
        type,
        status,
        duration,
        startedAt:
          new Date().toISOString(),
        participants:
          Array.isArray(participants)
            ? participants
            : [],
      });

    return res.status(201).json({
      log,
    });
  } catch (error) {
    console.error(
      'Failed to log call:',
      error
    );

    return res.status(500).json({
      error: 'Failed to log call',
    });
  }
}

// ============================================================
// CALL HISTORY
// ============================================================

export async function getCallHistory(
  _req: Request,
  res: Response
) {
  try {
    const logs =
      await db.getCallLogs();

    return res.json({
      logs,
    });
  } catch (error) {
    console.error(
      'Failed to fetch call history:',
      error
    );

    return res.status(500).json({
      error: 'Failed to fetch call history',
    });
  }
}