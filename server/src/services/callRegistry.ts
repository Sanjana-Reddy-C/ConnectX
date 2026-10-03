import { Server } from 'socket.io';

export type CallType = 'VOICE' | 'VIDEO';

export type CallStatus =
  | 'RINGING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ENDED';

export interface Call {
  callId: string;
  roomId: string;

  callerId: string;
  callerName: string;

  receiverId: string;
  receiverName: string;

  phoneNumber: string;

  type: CallType;
  status: CallStatus;

  createdAt: string;
}

const calls = new Map<string, Call>();

const onlineUsers = new Map<string, string>();

export const callRegistry = {
  createCall(data: {
    callId: string;
    roomId: string;
    callerId: string;
    callerName: string;
    receiverId: string;
    receiverName: string;
    phoneNumber: string;
    type: CallType;
  }): Call {
    const call: Call = {
      ...data,
      status: 'RINGING',
      createdAt: new Date().toISOString(),
    };

    calls.set(call.callId, call);

    return call;
  },

  getCall(callId: string): Call | undefined {
    return calls.get(callId);
  },

  updateCall(
    callId: string,
    status: CallStatus
  ): Call | undefined {
    const call = calls.get(callId);

    if (!call) {
      return undefined;
    }

    call.status = status;

    calls.set(callId, call);

    return call;
  },

  removeCall(callId: string): void {
    calls.delete(callId);
  },

  registerUser(
    userId: string,
    socketId: string
  ): void {
    onlineUsers.set(userId, socketId);
  },

  unregisterUser(
    userId: string
  ): void {
    onlineUsers.delete(userId);
  },

  isUserOnline(
    userId: string
  ): boolean {
    return onlineUsers.has(userId);
  },

  sendToUser(
    io: Server,
    userId: string,
    event: string,
    data: unknown
  ): void {
    const socketId = onlineUsers.get(userId);

    if (!socketId) {
      return;
    }

    io.to(socketId).emit(event, data);
  },

  getActiveCalls(): Call[] {
    return Array.from(calls.values());
  },
};