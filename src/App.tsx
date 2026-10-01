import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { SocketProvider, useSocket } from './context/SocketContext.js';
import { api } from './services/api.js';
import { Workspace, Channel, User, Message } from './types/index.js';

import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { ChatArea } from './components/ChatArea.js';
import { CallModal } from './components/CallModal.js';
import { IncomingCallDialog } from './components/IncomingCallDialog.js';
import { WorkspaceModal } from './components/WorkspaceModal.js';
import { AddChannelModal } from './components/AddChannelModal.js';
import { CallHistoryModal } from './components/CallHistoryModal.js';
import { AuthModal } from './components/AuthModal.js';

function MainApp() {
  const { user, isLoading } = useAuth();
  const {
    socket,
    incomingCall,
    acceptIncomingCall,
    declineIncomingCall,
    callResponseStatus,
    resetCallResponse,
    sendMessage: emitSocketMessage,
    joinChannelRoom,
    leaveChannelRoom,
    initiateCall,
    onNewMessage,
    onlineUsers,
  } = useSocket();

  // Navigation state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeDirectUser, setActiveDirectUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCountByUser, setUnreadCountByUser] = useState<Record<string, number>>({});

  // Active Call State
  const [activeCallRoomId, setActiveCallRoomId] = useState<string | null>(null);
  const [activeCallType, setActiveCallType] = useState<'VOICE' | 'VIDEO'>('VIDEO');

  // Modals state
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [showCallHistoryModal, setShowCallHistoryModal] = useState(false);

  // Load initial workspaces, users, and unread offline messages
  const loadInitialData = useCallback(async () => {
    if (!user) return;
    try {
      const [wsRes, usersRes, unreadRes] = await Promise.all([
        api.getWorkspaces(),
        api.getAllUsers(),
        api.getUnreadMessages(),
      ]);

      // Deduplicate workspaces by ID
      const uniqueWorkspaces: Workspace[] = [];
      const seenIds = new Set<string>();
      (wsRes.workspaces || []).forEach((w) => {
        if (!seenIds.has(w.id)) {
          seenIds.add(w.id);
          uniqueWorkspaces.push(w);
        }
      });
      setWorkspaces(uniqueWorkspaces);
      if (uniqueWorkspaces.length > 0) {
        const initialWs = uniqueWorkspaces[0];
        setActiveWorkspace(initialWs);
        if (initialWs.channels && initialWs.channels.length > 0) {
          setActiveChannel(initialWs.channels[0]);
          setActiveDirectUser(null);
        }
      }

      setUsers(usersRes.users);

      // Map unread offline messages
      const countMap: Record<string, number> = {};
      unreadRes.unreadMessages.forEach((m) => {
        countMap[m.senderId] = (countMap[m.senderId] || 0) + 1;
      });
      setUnreadCountByUser(countMap);
    } catch (err) {
      console.warn('Failed to load initial ConnectX data:', err);
    }
  }, [user]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Check if opened with a shareable call room link: ?callRoom=xxx&callType=VIDEO
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('callRoom');
    const typeFromUrl = (params.get('callType') as 'VOICE' | 'VIDEO') || 'VIDEO';
    if (roomFromUrl) {
      setActiveCallRoomId(roomFromUrl);
      setActiveCallType(typeFromUrl);
    }
  }, [user]);

  // Handle active channel switch & fetch messages
  useEffect(() => {
    if (activeChannel && !activeDirectUser) {
      joinChannelRoom(activeChannel.id);
      api
        .getChannelMessages(activeChannel.id)
        .then((res) => setMessages(res.messages))
        .catch((e) => console.warn(e));

      return () => {
        leaveChannelRoom(activeChannel.id);
      };
    }
  }, [activeChannel, activeDirectUser, joinChannelRoom, leaveChannelRoom]);

  // Handle direct user switch & fetch messages
  useEffect(() => {
    if (activeDirectUser) {
      api
        .getDirectMessages(activeDirectUser.id)
        .then((res) => {
          setMessages(res.messages);
          // Reset unread count for this user
          setUnreadCountByUser((prev) => ({ ...prev, [activeDirectUser.id]: 0 }));
        })
        .catch((e) => console.warn(e));
    }
  }, [activeDirectUser]);

  // Listen for real-time incoming messages via Socket.IO
  useEffect(() => {
    const cleanup = onNewMessage((newMsg: Message) => {
      // If message belongs to active channel
      if (activeChannel && newMsg.channelId === activeChannel.id && !activeDirectUser) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      // If message belongs to active direct message
      else if (
        activeDirectUser &&
        (newMsg.senderId === activeDirectUser.id || newMsg.recipientId === activeDirectUser.id)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      // Offline / Unread message arrived from another user
      else if (newMsg.recipientId === user?.id && newMsg.senderId) {
        setUnreadCountByUser((prev) => ({
          ...prev,
          [newMsg.senderId]: (prev[newMsg.senderId] || 0) + 1,
        }));
      }
    });

    return cleanup;
  }, [activeChannel, activeDirectUser, onNewMessage, user?.id]);

  // Handle call responses (e.g. peer accepted our call request)
  useEffect(() => {
    if (callResponseStatus) {
      if (callResponseStatus.accepted) {
        console.log('[ConnectX] Call accepted by peer!');
      } else {
        alert('The remote user declined the call.');
        setActiveCallRoomId(null);
      }
      resetCallResponse();
    }
  }, [callResponseStatus, resetCallResponse]);

  // Send message handler
  const handleSendMessage = (content: string) => {
    if (!user) return;

    if (activeDirectUser) {
      emitSocketMessage({
        content,
        recipientId: activeDirectUser.id,
      });
    } else if (activeChannel) {
      emitSocketMessage({
        content,
        channelId: activeChannel.id,
        workspaceId: activeWorkspace?.id,
      });
    }
  };

  // Start Call (Voice or Video)
  const handleStartCall = (type: 'VOICE' | 'VIDEO', targetUserOverride?: User) => {
    const target = targetUserOverride || activeDirectUser;
    const roomId = target
      ? `cx-p2p-${[user?.id, target.id].sort().join('-')}`
      : `cx-room-${activeChannel?.name || 'global'}`;

    setActiveCallType(type);
    setActiveCallRoomId(roomId);

    if (target) {
      initiateCall(target.id, roomId, type);
    }
  };

  // Instant Conference Video Room
  const handleOpenConferenceRoom = () => {
    setActiveCallType('VIDEO');
    setActiveCallRoomId('cx-enterprise-conference-room-1');
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
        Loading ConnectX Enterprise...
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  const isRecipientOnline = activeDirectUser
    ? (onlineUsers.get(activeDirectUser.id) || activeDirectUser.status) === 'online'
    : false;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden select-none">
      {/* Top Navigation */}
      <Navbar
        onOpenCallHistory={() => setShowCallHistoryModal(true)}
        onOpenActiveCallQuick={handleOpenConferenceRoom}
      />

      {/* Main Content: Sidebar + Chat Area */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={(ws) => {
            setActiveWorkspace(ws);
            if (ws.channels && ws.channels.length > 0) {
              setActiveChannel(ws.channels[0]);
              setActiveDirectUser(null);
            }
          }}
          activeChannel={activeChannel}
          onSelectChannel={(ch) => {
            setActiveChannel(ch);
            setActiveDirectUser(null);
          }}
          users={users}
          activeDirectUser={activeDirectUser}
          onSelectDirectUser={(u) => {
            setActiveDirectUser(u);
            setActiveChannel(null);
          }}
          onOpenNewWorkspaceModal={() => setShowWorkspaceModal(true)}
          onOpenAddChannelModal={() => setShowAddChannelModal(true)}
          onStartDirectCall={(target, type) => handleStartCall(type, target)}
          currentUserId={user.id}
          onlineUsersMap={onlineUsers}
          unreadCountByUser={unreadCountByUser}
        />

        <ChatArea
          activeChannel={activeChannel}
          activeDirectUser={activeDirectUser}
          messages={messages}
          currentUserId={user.id}
          onSendMessage={handleSendMessage}
          onStartCall={(type) => handleStartCall(type)}
          isRecipientOnline={isRecipientOnline}
        />
      </div>

      {/* WebRTC Video & Voice Call Modal */}
      {activeCallRoomId && socket && (
        <CallModal
          roomId={activeCallRoomId}
          socket={socket}
          currentUser={{ id: user.id, name: user.name, avatarUrl: user.avatarUrl }}
          initialType={activeCallType}
          onEndCall={() => {
            setActiveCallRoomId(null);
            // Clean URL query params if present
            const url = new URL(window.location.href);
            if (url.searchParams.has('callRoom')) {
              url.searchParams.delete('callRoom');
              url.searchParams.delete('callType');
              window.history.replaceState({}, '', url.pathname + (url.search || ''));
            }
          }}
        />
      )}

      {/* Real-time Incoming Call Dialog */}
      {incomingCall && (
        <IncomingCallDialog
          caller={incomingCall.caller}
          type={incomingCall.type}
          onAccept={() => {
            setActiveCallType(incomingCall.type);
            setActiveCallRoomId(incomingCall.roomId);
            acceptIncomingCall();
          }}
          onDecline={() => declineIncomingCall()}
        />
      )}

      {/* Create / Join Workspace Modal */}
      {showWorkspaceModal && (
        <WorkspaceModal
          onClose={() => setShowWorkspaceModal(false)}
          onWorkspaceCreatedOrJoined={(newWs) => {
            setWorkspaces((prev) => [...prev.filter((w) => w.id !== newWs.id), newWs]);
            setActiveWorkspace(newWs);
            if (newWs.channels && newWs.channels.length > 0) {
              setActiveChannel(newWs.channels[0]);
              setActiveDirectUser(null);
            }
          }}
        />
      )}

      {/* Add Channel Modal */}
      {showAddChannelModal && activeWorkspace && (
        <AddChannelModal
          workspaceId={activeWorkspace.id}
          onClose={() => setShowAddChannelModal(false)}
          onChannelAdded={(newChannel) => {
            setActiveWorkspace((prev) => {
              if (!prev) return prev;
              return { ...prev, channels: [...(prev.channels || []), newChannel] };
            });
            setActiveChannel(newChannel);
            setActiveDirectUser(null);
          }}
        />
      )}

      {/* Call History Modal */}
      {showCallHistoryModal && (
        <CallHistoryModal onClose={() => setShowCallHistoryModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}
