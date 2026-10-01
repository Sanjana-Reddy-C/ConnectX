import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';
import { Message } from '../types/index.js';

interface IncomingCallData {
  caller: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  roomId: string;
  type: 'VOICE' | 'VIDEO';
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;

  incomingCall: IncomingCallData | null;

  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;

  callResponseStatus: {
    accepted: boolean;
    responderId?: string;
  } | null;

  resetCallResponse: () => void;

  sendMessage: (msg: {
    content: string;
    channelId?: string;
    recipientId?: string;
    workspaceId?: string;
  }) => void;

  joinChannelRoom: (channelId: string) => void;
  leaveChannelRoom: (channelId: string) => void;

  initiateCall: (
    targetUserId: string,
    roomId: string,
    type: 'VOICE' | 'VIDEO'
  ) => void;

  onNewMessage: (
    callback: (msg: Message) => void
  ) => () => void;

  onlineUsers: Map<string, 'online' | 'offline'>;
}

const SocketContext =
  createContext<SocketContextType | undefined>(
    undefined
  );

export const SocketProvider: React.FC<{
  children: React.ReactNode;
  onCallAcceptedExternal?: (
    call: IncomingCallData
  ) => void;
}> = ({
  children,
  onCallAcceptedExternal,
}) => {
  const { user } = useAuth();

  const [socket, setSocket] =
    useState<Socket | null>(null);

  const [isConnected, setIsConnected] =
    useState(false);

  const [incomingCall, setIncomingCall] =
    useState<IncomingCallData | null>(null);

  const [callResponseStatus, setCallResponseStatus] =
    useState<{
      accepted: boolean;
      responderId?: string;
    } | null>(null);

  const [onlineUsers, setOnlineUsers] =
    useState<
      Map<string, 'online' | 'offline'>
    >(new Map());

  const messageListeners = useRef<
    Set<(msg: Message) => void>
  >(new Set());

  const socketRef =
    useRef<Socket | null>(null);

  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ============================================================
  // SOCKET CONNECTION
  // ============================================================

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setIsConnected(false);
      socketRef.current = null;
      return;
    }

    console.log(
      '[Socket] Creating socket for user:',
      user.name
    );

    const socketInstance = io(
      window.location.origin,
      {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      }
    );

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // ----------------------------------------------------------
    // Connected
    // ----------------------------------------------------------

    const handleConnect = () => {
      console.log(
        '[Socket] Connected to server, ID:',
        socketInstance.id
      );

      setIsConnected(true);

      socketInstance.emit(
        'register-user',
        {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }
      );
    };

    socketInstance.on(
      'connect',
      handleConnect
    );

    // ----------------------------------------------------------
    // Disconnected
    // ----------------------------------------------------------

    const handleDisconnect = () => {
      console.log(
        '[Socket] Disconnected from server'
      );

      setIsConnected(false);
    };

    socketInstance.on(
      'disconnect',
      handleDisconnect
    );

    // ----------------------------------------------------------
    // Incoming call
    // ----------------------------------------------------------

    const handleIncomingCall = (
      data: IncomingCallData
    ) => {
      console.log(
        '[Socket] Incoming call:',
        data
      );

      // Do not replace an existing incoming call.
      setIncomingCall((current) => {
        if (current) {
          console.log(
            '[Socket] Already showing an incoming call. Ignoring another call.'
          );

          return current;
        }

        return data;
      });
    };

    socketInstance.on(
      'incoming-call',
      handleIncomingCall
    );

    // ----------------------------------------------------------
    // Call response
    // ----------------------------------------------------------

    const handleCallResponse = (res: {
      accepted: boolean;
      responderId?: string;
      roomId: string;
    }) => {
      console.log(
        '[Socket] Call response:',
        res
      );

      setCallResponseStatus({
        accepted: res.accepted,
        responderId: res.responderId,
      });
    };

    socketInstance.on(
      'call-response',
      handleCallResponse
    );

    // ----------------------------------------------------------
    // Call status
    // ----------------------------------------------------------

    const handleCallStatus = (data: {
      targetUserId: string;
      status: string;
      message?: string;
    }) => {
      console.log(
        '[Socket] Call status:',
        data
      );

      if (data.status === 'busy') {
        setCallResponseStatus({
          accepted: false,
        });
      }
    };

    socketInstance.on(
      'call-status',
      handleCallStatus
    );

    // ----------------------------------------------------------
    // User presence
    // ----------------------------------------------------------

    const handlePresenceChange = (data: {
      userId: string;
      status: 'online' | 'offline';
    }) => {
      setOnlineUsers((previous) => {
        const next = new Map(previous);

        next.set(
          data.userId,
          data.status
        );

        return next;
      });
    };

    socketInstance.on(
      'user-presence-change',
      handlePresenceChange
    );

    // ----------------------------------------------------------
    // Messages
    // ----------------------------------------------------------

    const handleNewMessage = (
      msg: Message
    ) => {
      messageListeners.current.forEach(
        (callback) => {
          callback(msg);
        }
      );
    };

    socketInstance.on(
      'new-message',
      handleNewMessage
    );

    // ----------------------------------------------------------
    // Cleanup
    // ----------------------------------------------------------

    return () => {
      console.log(
        '[Socket] Cleaning up socket for user:',
        user.name
      );

      socketInstance.off(
        'connect',
        handleConnect
      );

      socketInstance.off(
        'disconnect',
        handleDisconnect
      );

      socketInstance.off(
        'incoming-call',
        handleIncomingCall
      );

      socketInstance.off(
        'call-response',
        handleCallResponse
      );

      socketInstance.off(
        'call-status',
        handleCallStatus
      );

      socketInstance.off(
        'user-presence-change',
        handlePresenceChange
      );

      socketInstance.off(
        'new-message',
        handleNewMessage
      );

      socketInstance.disconnect();

      if (
        socketRef.current ===
        socketInstance
      ) {
        socketRef.current = null;
      }

      setSocket((current) =>
        current === socketInstance
          ? null
          : current
      );

      setIsConnected(false);
      setIncomingCall(null);
    };
  }, [
    user?.id,
    user?.name,
    user?.avatarUrl,
  ]);

  // ============================================================
  // ACCEPT INCOMING CALL
  // ============================================================

  const acceptIncomingCall =
    useCallback(() => {
      const currentSocket =
        socketRef.current;

      const currentCall =
        incomingCall;

      if (
        !currentSocket ||
        !currentCall ||
        !userRef.current
      ) {
        return;
      }

      console.log(
        '[Socket] Accepting call from:',
        currentCall.caller.name
      );

      currentSocket.emit(
        'respond-call',
        {
          targetCallerId:
            currentCall.caller.id,
          accepted: true,
          roomId: currentCall.roomId,
        }
      );

      if (onCallAcceptedExternal) {
        onCallAcceptedExternal(
          currentCall
        );
      }

      setIncomingCall(null);
    }, [
      incomingCall,
      onCallAcceptedExternal,
    ]);

  // ============================================================
  // DECLINE INCOMING CALL
  // ============================================================

  const declineIncomingCall =
    useCallback(() => {
      const currentSocket =
        socketRef.current;

      const currentCall =
        incomingCall;

      if (
        !currentSocket ||
        !currentCall
      ) {
        return;
      }

      console.log(
        '[Socket] Declining call from:',
        currentCall.caller.name
      );

      currentSocket.emit(
        'respond-call',
        {
          targetCallerId:
            currentCall.caller.id,
          accepted: false,
          roomId: currentCall.roomId,
        }
      );

      setIncomingCall(null);
    }, [incomingCall]);

  // ============================================================
  // RESET CALL RESPONSE
  // ============================================================

  const resetCallResponse =
    useCallback(() => {
      setCallResponseStatus(null);
    }, []);

  // ============================================================
  // SEND MESSAGE
  // ============================================================

  const sendMessage =
    useCallback(
      (msg: {
        content: string;
        channelId?: string;
        recipientId?: string;
        workspaceId?: string;
      }) => {
        const currentSocket =
          socketRef.current;

        const currentUser =
          userRef.current;

        if (
          currentSocket &&
          currentUser
        ) {
          currentSocket.emit(
            'send-message',
            {
              ...msg,
              senderId:
                currentUser.id,
              senderName:
                currentUser.name,
            }
          );
        }
      },
      []
    );

  // ============================================================
  // CHANNEL ROOMS
  // ============================================================

  const joinChannelRoom =
    useCallback(
      (channelId: string) => {
        socketRef.current?.emit(
          'join-channel',
          channelId
        );
      },
      []
    );

  const leaveChannelRoom =
    useCallback(
      (channelId: string) => {
        socketRef.current?.emit(
          'leave-channel',
          channelId
        );
      },
      []
    );

  // ============================================================
  // INITIATE CALL
  // ============================================================

  const initiateCall =
    useCallback(
      (
        targetUserId: string,
        roomId: string,
        type: 'VOICE' | 'VIDEO'
      ) => {
        const currentSocket =
          socketRef.current;

        const currentUser =
          userRef.current;

        if (
          !currentSocket ||
          !currentUser
        ) {
          console.warn(
            '[Socket] Cannot initiate call: socket/user unavailable.'
          );

          return;
        }

        console.log(
          `[Socket] Calling ${targetUserId} in room ${roomId}`
        );

        currentSocket.emit(
          'call-user',
          {
            targetUserId,
            caller: {
              id: currentUser.id,
              name: currentUser.name,
              avatarUrl:
                currentUser.avatarUrl,
            },
            roomId,
            type,
          }
        );
      },
      []
    );

  // ============================================================
  // MESSAGE LISTENERS
  // ============================================================

  const onNewMessage =
    useCallback(
      (
        callback: (msg: Message) => void
      ) => {
        messageListeners.current.add(
          callback
        );

        return () => {
          messageListeners.current.delete(
            callback
          );
        };
      },
      []
    );

  // ============================================================
  // CONTEXT
  // ============================================================

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,

        incomingCall,

        acceptIncomingCall,
        declineIncomingCall,

        callResponseStatus,
        resetCallResponse,

        sendMessage,

        joinChannelRoom,
        leaveChannelRoom,

        initiateCall,

        onNewMessage,

        onlineUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket() {
  const context =
    useContext(SocketContext);

  if (!context) {
    throw new Error(
      'useSocket must be used within SocketProvider'
    );
  }

  return context;
}