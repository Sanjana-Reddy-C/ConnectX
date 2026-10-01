export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  workspaceId: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
  channels: Channel[];
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  channelId?: string;
  recipientId?: string;
  workspaceId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface CallLog {
  id: string;
  initiatorId: string;
  initiatorName: string;
  roomId: string;
  type: 'VOICE' | 'VIDEO';
  status: 'COMPLETED' | 'MISSED' | 'REJECTED';
  duration: number;
  startedAt: string;
  endedAt?: string;
  participants: string[];
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRtcConfig {
  iceServers: IceServerConfig[];
  iceCandidatePoolSize: number;
}