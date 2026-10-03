import {
  Server as SocketIOServer,
  Socket,
} from 'socket.io';

import { callRegistry } from '../services/callRegistry.js';
import { db } from '../services/db.js';

interface ConnectedUser {
  socketId: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  roomId?: string;
}

interface PendingCall {
  roomId: string;
  callerSocketId: string;
  callerUserId: string;
  targetSocketId: string;
  targetUserId: string;
  createdAt: number;
}

export function setupSocketSignaling(
  io: SocketIOServer
) {
  // socketId -> ConnectedUser
  const connectedSockets =
    new Map<string, ConnectedUser>();

  // userId -> socketIds
  const userSocketMap =
    new Map<string, Set<string>>();

  // roomId -> pending direct call
  const pendingCalls =
    new Map<string, PendingCall>();

  // userId -> active call room
  const activeCalls =
    new Map<string, string>();

  io.on(
    'connection',
    (socket: Socket) => {
      console.log(
        `[Socket.IO] Client connected: ${socket.id}`
      );

      // --------------------------------------------------------
      // Recover userId from socket authentication if available
      // --------------------------------------------------------

      const userId =
        socket.handshake.auth?.userId ||
        socket.handshake.query?.userId;

      if (userId) {
        const normalizedUserId =
          String(userId);

        socket.data.userId =
          normalizedUserId;
      }

      // ========================================================
      // REGISTER USER
      // ========================================================

      socket.on(
        'register-user',
        async (userData: {
          id: string;
          name: string;
          avatarUrl?: string;
        }) => {
          try {
            const previousUser =
              connectedSockets.get(
                socket.id
              );

            // If this socket was previously registered
            // as another user, remove the old mapping.
            if (
              previousUser &&
              previousUser.userId !==
                userData.id
            ) {
              const previousSockets =
                userSocketMap.get(
                  previousUser.userId
                );

              if (previousSockets) {
                previousSockets.delete(
                  socket.id
                );

                if (
                  previousSockets.size === 0
                ) {
                  userSocketMap.delete(
                    previousUser.userId
                  );
                }
              }

              callRegistry.unregisterUser(
                previousUser.userId
              );
            }

            const user: ConnectedUser = {
              socketId: socket.id,
              userId: userData.id,
              name: userData.name,
              avatarUrl:
                userData.avatarUrl,
              roomId:
                previousUser?.roomId,
            };

            connectedSockets.set(
              socket.id,
              user
            );

            if (
              !userSocketMap.has(
                userData.id
              )
            ) {
              userSocketMap.set(
                userData.id,
                new Set()
              );
            }

            userSocketMap
              .get(userData.id)!
              .add(socket.id);

            callRegistry.registerUser(
              userData.id,
              socket.id
            );

            socket.data.userId =
              userData.id;

            await db.updateUserStatus(
              userData.id,
              'online'
            );

            io.emit(
              'user-presence-change',
              {
                userId: userData.id,
                status: 'online',
                name: userData.name,
              }
            );

            console.log(
              `[Socket.IO] Registered ${userData.name} (${socket.id})`
            );
          } catch (error) {
            console.error(
              '[Socket.IO] Failed to register user:',
              error
            );
          }
        }
      );

      // ========================================================
      // JOIN WEBRTC ROOM
      // ========================================================

      socket.on(
        'join-room',
        (data: {
          roomId: string;
          user: {
            id: string;
            name: string;
            avatarUrl?: string;
          };
        }) => {
          const {
            roomId,
            user,
          } = data;

          if (!roomId || !user?.id) {
            return;
          }

          const existingSocketUser =
            connectedSockets.get(
              socket.id
            );

          // ----------------------------------------------------
          // DUPLICATE JOIN PROTECTION
          // ----------------------------------------------------

          if (
            existingSocketUser?.roomId ===
            roomId
          ) {
            console.log(
              `[Socket.IO] Ignoring duplicate room join: ${user.name} (${socket.id}) -> ${roomId}`
            );

            return;
          }

          // ----------------------------------------------------
          // Leave previous room first
          // ----------------------------------------------------

          if (
            existingSocketUser?.roomId &&
            existingSocketUser.roomId !==
              roomId
          ) {
            const oldRoom =
              existingSocketUser.roomId;

            socket.leave(oldRoom);

            socket
              .to(oldRoom)
              .emit(
                'user-left-room',
                {
                  socketId:
                    socket.id,
                  userId:
                    existingSocketUser.userId,
                  name:
                    existingSocketUser.name,
                }
              );
          }

          // ----------------------------------------------------
          // Join new room
          // ----------------------------------------------------

          socket.join(roomId);

          const userInfo: ConnectedUser = {
            socketId: socket.id,
            userId: user.id,
            name: user.name,
            avatarUrl:
              user.avatarUrl,
            roomId,
          };

          connectedSockets.set(
            socket.id,
            userInfo
          );

          // ----------------------------------------------------
          // Find existing peers
          // ----------------------------------------------------

          const roomClients =
            io.sockets.adapter.rooms.get(
              roomId
            );

          const existingUsers: {
            socketId: string;
            user: ConnectedUser;
          }[] = [];

          if (roomClients) {
            roomClients.forEach(
              (clientId) => {
                if (
                  clientId ===
                  socket.id
                ) {
                  return;
                }

                const peerUser =
                  connectedSockets.get(
                    clientId
                  );

                if (peerUser) {
                  existingUsers.push({
                    socketId:
                      clientId,
                    user:
                      peerUser,
                  });
                }
              }
            );
          }

          // ----------------------------------------------------
          // Tell joining user about existing users
          // ----------------------------------------------------

          socket.emit(
            'all-users-in-room',
            existingUsers
          );

          // ----------------------------------------------------
          // Tell existing users that someone joined
          // ----------------------------------------------------

          socket
            .to(roomId)
            .emit(
              'user-joined-room',
              {
                socketId:
                  socket.id,
                user:
                  userInfo,
              }
            );

          console.log(
            `[Socket.IO] ${user.name} (${socket.id}) joined room: ${roomId}`
          );
        }
      );

      // ========================================================
      // WEBRTC OFFER
      // ========================================================

      socket.on(
        'offer',
        (payload: {
          targetSocketId: string;
          callerSocketId?: string;
          callerUser?: any;
          sdp: any;
          isAudioOnly?: boolean;
        }) => {
          if (
            !payload.targetSocketId ||
            !payload.sdp
          ) {
            return;
          }

          io.to(
            payload.targetSocketId
          ).emit(
            'offer',
            {
              sdp:
                payload.sdp,

              callerSocketId:
                socket.id,

              callerUser:
                payload.callerUser,

              isAudioOnly:
                payload.isAudioOnly,
            }
          );
        }
      );

      // ========================================================
      // WEBRTC ANSWER
      // ========================================================

      socket.on(
        'answer',
        (payload: {
          targetSocketId: string;
          answererSocketId?: string;
          sdp: any;
        }) => {
          if (
            !payload.targetSocketId ||
            !payload.sdp
          ) {
            return;
          }

          io.to(
            payload.targetSocketId
          ).emit(
            'answer',
            {
              sdp:
                payload.sdp,

              answererSocketId:
                socket.id,
            }
          );
        }
      );

      // ========================================================
      // ICE CANDIDATE
      // ========================================================

      socket.on(
        'ice-candidate',
        (payload: {
          targetSocketId: string;
          candidate: any;
        }) => {
          if (
            !payload.targetSocketId ||
            !payload.candidate
          ) {
            return;
          }

          io.to(
            payload.targetSocketId
          ).emit(
            'ice-candidate',
            {
              candidate:
                payload.candidate,

              fromSocketId:
                socket.id,
            }
          );
        }
      );

      // ========================================================
      // MEDIA TOGGLE
      // ========================================================

      socket.on(
        'media-toggle',
        (payload: {
          roomId: string;
          isMuted?: boolean;
          isCameraOff?: boolean;
          isScreenSharing?: boolean;
        }) => {
          if (!payload.roomId) {
            return;
          }

          socket
            .to(payload.roomId)
            .emit(
              'peer-media-toggle',
              {
                socketId:
                  socket.id,

                ...payload,
              }
            );
        }
      );

      // ========================================================
      // DIRECT CALL
      // ========================================================

      socket.on(
        'call-user',
        (payload: {
          targetUserId: string;

          caller: {
            id: string;
            name: string;
            avatarUrl?: string;
          };

          roomId: string;

          type:
            | 'VOICE'
            | 'VIDEO';
        }) => {
          const {
            targetUserId,
            caller,
            roomId,
            type,
          } = payload;

          if (
            !targetUserId ||
            !caller?.id ||
            !roomId
          ) {
            return;
          }

          // ----------------------------------------------------
          // Caller already in a call
          // ----------------------------------------------------

          const callerActiveRoom =
            activeCalls.get(
              caller.id
            );

          if (callerActiveRoom) {
            socket.emit(
              'call-status',
              {
                targetUserId,
                status: 'busy',
                message:
                  'You are already in another call.',
              }
            );

            return;
          }

          // ----------------------------------------------------
          // Target already in a call
          // ----------------------------------------------------

          const targetActiveRoom =
            activeCalls.get(
              targetUserId
            );

          if (targetActiveRoom) {
            socket.emit(
              'call-status',
              {
                targetUserId,
                status: 'busy',
                message:
                  'This user is currently in another call.',
              }
            );

            return;
          }

          // ----------------------------------------------------
          // Find target sockets
          // ----------------------------------------------------

          const targetSockets =
            userSocketMap.get(
              targetUserId
            );

          if (
            !targetSockets ||
            targetSockets.size === 0
          ) {
            socket.emit(
              'call-status',
              {
                targetUserId,
                status:
                  'unavailable',
                message:
                  'User is currently offline. You can leave an offline message.',
              }
            );

            return;
          }

          // ----------------------------------------------------
          // Send to ONE target socket only.
          // Prevents multiple tabs from answering the
          // same incoming call.
          // ----------------------------------------------------

          const targetSocketId =
            targetSockets.values()
              .next().value as
              | string
              | undefined;

          if (!targetSocketId) {
            socket.emit(
              'call-status',
              {
                targetUserId,
                status:
                  'unavailable',
              }
            );

            return;
          }

          // ----------------------------------------------------
          // Reserve caller while ringing
          // ----------------------------------------------------

          activeCalls.set(
            caller.id,
            roomId
          );

          pendingCalls.set(
            roomId,
            {
              roomId,

              callerSocketId:
                socket.id,

              callerUserId:
                caller.id,

              targetSocketId,

              targetUserId,

              createdAt:
                Date.now(),
            }
          );

          io.to(
            targetSocketId
          ).emit(
            'incoming-call',
            {
              caller,
              roomId,
              type,
            }
          );

          console.log(
            `[Socket.IO] Call from ${caller.name} -> ${targetUserId} | room=${roomId}`
          );
        }
      );

      // ========================================================
      // CALL RESPONSE
      // ========================================================

      socket.on(
        'respond-call',
        (payload: {
          targetCallerId: string;
          accepted: boolean;
          roomId: string;
        }) => {
          const pending =
            pendingCalls.get(
              payload.roomId
            );

          // ----------------------------------------------------
          // Call is no longer pending
          // ----------------------------------------------------

          if (!pending) {
            console.warn(
              `[Socket.IO] No pending call found for room ${payload.roomId}`
            );

            return;
          }

          // ----------------------------------------------------
          // Only intended target may respond
          // ----------------------------------------------------

          if (
            pending.targetSocketId !==
            socket.id
          ) {
            console.warn(
              `[Socket.IO] Ignoring response from unexpected socket ${socket.id}`
            );

            return;
          }

          // ----------------------------------------------------
          // DECLINED
          // ----------------------------------------------------

          if (!payload.accepted) {
            activeCalls.delete(
              pending.callerUserId
            );

            pendingCalls.delete(
              payload.roomId
            );

            io.to(
              pending.callerSocketId
            ).emit(
              'call-response',
              {
                accepted: false,

                roomId:
                  payload.roomId,

                responderId:
                  pending.targetUserId,
              }
            );

            console.log(
              `[Socket.IO] Call declined: ${payload.roomId}`
            );

            return;
          }

          // ----------------------------------------------------
          // Target became busy while ringing
          // ----------------------------------------------------

          if (
            activeCalls.has(
              pending.targetUserId
            )
          ) {
            activeCalls.delete(
              pending.callerUserId
            );

            pendingCalls.delete(
              payload.roomId
            );

            io.to(
              pending.callerSocketId
            ).emit(
              'call-response',
              {
                accepted: false,

                roomId:
                  payload.roomId,

                responderId:
                  pending.targetUserId,
              }
            );

            return;
          }

          // ----------------------------------------------------
          // ACCEPT
          // ----------------------------------------------------

          activeCalls.set(
            pending.callerUserId,
            pending.roomId
          );

          activeCalls.set(
            pending.targetUserId,
            pending.roomId
          );

          pendingCalls.delete(
            payload.roomId
          );

          // Send response only to original caller
          io.to(
            pending.callerSocketId
          ).emit(
            'call-response',
            {
              accepted: true,

              roomId:
                payload.roomId,

              responderId:
                pending.targetUserId,
            }
          );

          console.log(
            `[Socket.IO] Call accepted: ${payload.roomId}`
          );
        }
      );

      // ========================================================
      // CHAT CHANNELS
      // ========================================================

      socket.on(
        'join-channel',
        (channelId: string) => {
          if (!channelId) {
            return;
          }

          socket.join(
            `channel:${channelId}`
          );
        }
      );

      socket.on(
        'leave-channel',
        (channelId: string) => {
          if (!channelId) {
            return;
          }

          socket.leave(
            `channel:${channelId}`
          );
        }
      );

      // ========================================================
      // MESSAGES
      // ========================================================

      socket.on(
        'send-message',
        async (data: {
          content: string;
          senderId: string;
          senderName: string;
          channelId?: string;
          recipientId?: string;
          workspaceId?: string;
        }) => {
          try {
            const savedMsg =
              await db.saveMessage({
                content:
                  data.content,

                senderId:
                  data.senderId,

                senderName:
                  data.senderName,

                channelId:
                  data.channelId,

                recipientId:
                  data.recipientId,

                workspaceId:
                  data.workspaceId,
              });

            if (data.channelId) {
              io.to(
                `channel:${data.channelId}`
              ).emit(
                'new-message',
                savedMsg
              );
            } else if (
              data.recipientId
            ) {
              const recipientSockets =
                userSocketMap.get(
                  data.recipientId
                );

              if (
                recipientSockets &&
                recipientSockets.size > 0
              ) {
                recipientSockets.forEach(
                  (socketId) => {
                    io.to(
                      socketId
                    ).emit(
                      'new-message',
                      savedMsg
                    );
                  }
                );
              }

              // Echo to sender's other sockets
              const senderSockets =
                userSocketMap.get(
                  data.senderId
                );

              if (senderSockets) {
                senderSockets.forEach(
                  (socketId) => {
                    io.to(
                      socketId
                    ).emit(
                      'new-message',
                      savedMsg
                    );
                  }
                );
              }
            }
          } catch (error) {
            console.error(
              '[Socket.IO] Failed to send message:',
              error
            );
          }
        }
      );

      // ========================================================
      // LEAVE CALL ROOM
      // ========================================================

      socket.on(
        'leave-room',
        (roomId: string) => {
          const user =
            connectedSockets.get(
              socket.id
            );

          if (!user) {
            return;
          }

          socket.leave(roomId);

          socket
            .to(roomId)
            .emit(
              'user-left-room',
              {
                socketId:
                  socket.id,

                userId:
                  user.userId,

                name:
                  user.name,
              }
            );

          // Release active call state
          if (
            activeCalls.get(
              user.userId
            ) === roomId
          ) {
            activeCalls.delete(
              user.userId
            );
          }

          // Remove pending call if this room belongs to it
          const pending =
            pendingCalls.get(
              roomId
            );

          if (pending) {
            pendingCalls.delete(
              roomId
            );

            if (
              activeCalls.get(
                pending.callerUserId
              ) === roomId
            ) {
              activeCalls.delete(
                pending.callerUserId
              );
            }

            if (
              activeCalls.get(
                pending.targetUserId
              ) === roomId
            ) {
              activeCalls.delete(
                pending.targetUserId
              );
            }
          }

          // Clear room from connected socket
          user.roomId =
            undefined;

          connectedSockets.set(
            socket.id,
            user
          );

          console.log(
            `[Socket.IO] ${user.name} left room: ${roomId}`
          );
        }
      );

      // ========================================================
      // DISCONNECT
      // ========================================================

      socket.on(
        'disconnect',
        async () => {
          try {
            const user =
              connectedSockets.get(
                socket.id
              );

            if (user) {
              // -----------------------------------------------
              // Tell room peers
              // -----------------------------------------------

              if (user.roomId) {
                socket
                  .to(user.roomId)
                  .emit(
                    'user-left-room',
                    {
                      socketId:
                        socket.id,

                      userId:
                        user.userId,

                      name:
                        user.name,
                    }
                  );

                if (
                  activeCalls.get(
                    user.userId
                  ) ===
                  user.roomId
                ) {
                  activeCalls.delete(
                    user.userId
                  );
                }

                const pending =
                  pendingCalls.get(
                    user.roomId
                  );

                if (pending) {
                  pendingCalls.delete(
                    user.roomId
                  );

                  if (
                    activeCalls.get(
                      pending.callerUserId
                    ) ===
                    user.roomId
                  ) {
                    activeCalls.delete(
                      pending.callerUserId
                    );
                  }

                  if (
                    activeCalls.get(
                      pending.targetUserId
                    ) ===
                    user.roomId
                  ) {
                    activeCalls.delete(
                      pending.targetUserId
                    );
                  }
                }
              }

              // -----------------------------------------------
              // Clean pending calls involving this socket
              // -----------------------------------------------

              for (
                const [
                  roomId,
                  pending,
                ] of pendingCalls.entries()
              ) {
                if (
                  pending.callerSocketId ===
                    socket.id ||
                  pending.targetSocketId ===
                    socket.id
                ) {
                  pendingCalls.delete(
                    roomId
                  );

                  if (
                    activeCalls.get(
                      pending.callerUserId
                    ) === roomId
                  ) {
                    activeCalls.delete(
                      pending.callerUserId
                    );
                  }

                  if (
                    activeCalls.get(
                      pending.targetUserId
                    ) === roomId
                  ) {
                    activeCalls.delete(
                      pending.targetUserId
                    );
                  }
                }
              }

              // -----------------------------------------------
              // Remove socket from user map
              // -----------------------------------------------

              const userSockets =
                userSocketMap.get(
                  user.userId
                );

              if (userSockets) {
                userSockets.delete(
                  socket.id
                );

                if (
                  userSockets.size ===
                  0
                ) {
                  userSocketMap.delete(
                    user.userId
                  );

                  activeCalls.delete(
                    user.userId
                  );

                  callRegistry.unregisterUser(
                    user.userId
                  );

                  await db.updateUserStatus(
                    user.userId,
                    'offline'
                  );

                  io.emit(
                    'user-presence-change',
                    {
                      userId:
                        user.userId,

                      status:
                        'offline',

                      name:
                        user.name,
                    }
                  );
                }
              }

              connectedSockets.delete(
                socket.id
              );
            }

            console.log(
              `[Socket.IO] Client disconnected: ${socket.id}`
            );
          } catch (error) {
            console.error(
              '[Socket.IO] Disconnect cleanup failed:',
              error
            );
          }
        }
      );
    }
  );
}