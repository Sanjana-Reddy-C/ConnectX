import { Server } from 'socket.io';

interface ActiveCall {
  callId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  phoneNumber: string;
  type: 'VOICE' | 'VIDEO';
  status: 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'ENDED';
  createdAt: string;
}

class CallRegistry {
  private calls = new Map<string, ActiveCall>();

  private userSockets = new Map<string, Set<string>>();

  registerSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }

    this.userSockets.get(userId)!.add(socketId);
  }

  unregisterSocket(userId: string, socketId: string) {
    const sockets = this.userSockets.get(userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.userSockets.delete(userId);
    }
  }

  getUserSockets(userId: string): string[] {
    return Array.from(
      this.userSockets.get(userId) || []
    );
  }

  isUserOnline(userId: string): boolean {
    return this.getUserSockets(userId).length > 0;
  }

  createCall(data: Omit<ActiveCall, 'status' | 'createdAt'>) {
    const call: ActiveCall = {
      ...data,
      status: 'RINGING',
      createdAt: new Date().toISOString(),
    };

    this.calls.set(call.callId, call);

    return call;
  }

  getCall(callId: string) {
    return this.calls.get(callId);
  }

  updateCall(
    callId: string,
    status: ActiveCall['status']
  ) {
    const call = this.calls.get(callId);

    if (!call) {
      return undefined;
    }

    call.status = status;

    this.calls.set(callId, call);

    return call;
  }

  removeCall(callId: string) {
    this.calls.delete(callId);
  }

  sendToUser(
    io: Server,
    userId: string,
    event: string,
    data: unknown
  ) {
    const socketIds = this.getUserSockets(userId);

    for (const socketId of socketIds) {
      io.to(socketId).emit(event, data);
    }

    return socketIds.length > 0;
  }
}

export const callRegistry = new CallRegistry();