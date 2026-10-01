import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  passwordHash: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  lastSeen: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
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
  recipientId?: string;
  channelId?: string;
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

interface DatabaseData {
  users: User[];
  workspaces: Workspace[];
  members: WorkspaceMember[];
  messages: Message[];
  callLogs: CallLog[];
}

const DATA_FILE = path.join(process.cwd(), 'data-store.json');

function normalizePhoneNumber(phone?: string): string | undefined {
  if (!phone) return undefined;

  const cleaned = phone.trim().replace(/[^\d+]/g, '');

  if (!cleaned) return undefined;

  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  return cleaned.replace(/\D/g, '');
}

class DatabaseService {
  private data: DatabaseData = {
    users: [],
    workspaces: [],
    members: [],
    messages: [],
    callLogs: [],
  };

  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');

        if (raw.trim()) {
          const parsed = JSON.parse(raw);

          const seenWsIds = new Set<string>();
          const uniqueWorkspaces: Workspace[] = [];

          (parsed.workspaces || []).forEach((ws: Workspace) => {
            if (!seenWsIds.has(ws.id)) {
              seenWsIds.add(ws.id);
              uniqueWorkspaces.push(ws);
            }
          });

          this.data = {
            users: (parsed.users || []).map((user: User) => ({
              ...user,
              phoneNumber: normalizePhoneNumber(user.phoneNumber),
            })),

            workspaces: uniqueWorkspaces,

            members: parsed.members || [],

            messages: parsed.messages || [],

            callLogs: parsed.callLogs || [],
          };
        }
      }
    } catch (err) {
      console.error('Failed to read database store file:', err);
    }

    if (this.data.workspaces.length === 0) {
      this.seedInitialData();
    }
  }

  private save(immediate = false) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    const write = () => {
      try {
        fs.writeFileSync(
          DATA_FILE,
          JSON.stringify(this.data, null, 2),
          'utf-8'
        );
      } catch (err) {
        console.error('Failed to write database store file:', err);
      }
    };

    if (immediate) {
      write();
    } else {
      this.saveTimeout = setTimeout(write, 150);
    }
  }

  private seedInitialData() {
    const defaultWorkspaceId = 'ws-global-enterprise';

    const now = new Date().toISOString();

    const defaultWorkspace: Workspace = {
      id: defaultWorkspaceId,
      name: 'ConnectX Global Enterprise',
      description:
        'Primary cross-border collaboration hub for engineering and product teams',
      inviteCode: 'CONNECTX-GLOBAL',
      ownerId: 'user-demo-1',
      createdAt: now,
      channels: [
        {
          id: 'ch-general',
          name: 'general',
          workspaceId: defaultWorkspaceId,
          isPrivate: false,
          createdAt: now,
        },
        {
          id: 'ch-announcements',
          name: 'announcements',
          workspaceId: defaultWorkspaceId,
          isPrivate: false,
          createdAt: now,
        },
        {
          id: 'ch-voice-video-room',
          name: 'conference-room-1',
          workspaceId: defaultWorkspaceId,
          isPrivate: false,
          createdAt: now,
        },
      ],
    };

    this.data.workspaces.push(defaultWorkspace);

    this.save();
  }

  // ============================================================
  // USERS
  // ============================================================

  public async getUsers(): Promise<User[]> {
    return this.data.users;
  }

  public async getUserById(id: string): Promise<User | undefined> {
    return this.data.users.find((user) => user.id === id);
  }

  public async getUserByEmail(
    email: string
  ): Promise<User | undefined> {
    const cleanEmail = email.trim().toLowerCase();

    return this.data.users.find(
      (user) => user.email.trim().toLowerCase() === cleanEmail
    );
  }

  public async getUserByPhone(
    phoneNumber: string
  ): Promise<User | undefined> {
    const normalized = normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      return undefined;
    }

    return this.data.users.find(
      (user) =>
        normalizePhoneNumber(user.phoneNumber) === normalized
    );
  }

  public async phoneNumberExists(
    phoneNumber: string,
    excludeUserId?: string
  ): Promise<boolean> {
    const normalized = normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      return false;
    }

    return this.data.users.some(
      (user) =>
        user.id !== excludeUserId &&
        normalizePhoneNumber(user.phoneNumber) === normalized
    );
  }

  public async createUser(
    user: Omit<User, 'createdAt' | 'lastSeen' | 'status'>
  ): Promise<User> {
    const newUser: User = {
      ...user,
      email: user.email.trim().toLowerCase(),
      phoneNumber: normalizePhoneNumber(user.phoneNumber),
      status: 'online',
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);

    // Automatically add the user to the default workspace.
    if (this.data.workspaces.length > 0) {
      const defaultWorkspace = this.data.workspaces[0];

      this.data.members.push({
        id: `member-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 7)}`,

        userId: newUser.id,

        workspaceId: defaultWorkspace.id,

        role: 'MEMBER',

        joinedAt: new Date().toISOString(),
      });
    }

    this.save(true);

    return newUser;
  }

  public async updateUserStatus(
    userId: string,
    status: User['status']
  ): Promise<void> {
    const user = this.data.users.find(
      (item) => item.id === userId
    );

    if (!user) {
      return;
    }

    user.status = status;
    user.lastSeen = new Date().toISOString();

    this.save();
  }

  // ============================================================
  // WORKSPACES
  // ============================================================

  public async getWorkspacesForUser(
    userId: string
  ): Promise<Workspace[]> {
    const memberWorkspaceIds = this.data.members
      .filter((member) => member.userId === userId)
      .map((member) => member.workspaceId);

    return this.data.workspaces.filter(
      (workspace) =>
        workspace.ownerId === userId ||
        memberWorkspaceIds.includes(workspace.id)
    );
  }

  public async createWorkspace(
    name: string,
    description: string,
    ownerId: string
  ): Promise<Workspace> {
    const now = new Date().toISOString();

    const id = `ws-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;

    const inviteCode = `CX-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const workspace: Workspace = {
      id,

      name: name.trim(),

      description: description.trim(),

      inviteCode,

      ownerId,

      createdAt: now,

      channels: [
        {
          id: `ch-${Date.now()}-general`,

          name: 'general',

          workspaceId: id,

          isPrivate: false,

          createdAt: now,
        },
      ],
    };

    this.data.workspaces.push(workspace);

    this.data.members.push({
      id: `member-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}`,

      userId: ownerId,

      workspaceId: id,

      role: 'OWNER',

      joinedAt: now,
    });

    this.save(true);

    return workspace;
  }

  public async joinWorkspace(
    userId: string,
    workspaceId: string
  ): Promise<Workspace | undefined> {
    const workspace = this.data.workspaces.find(
      (item) => item.id === workspaceId
    );

    if (!workspace) {
      return undefined;
    }

    const existingMember = this.data.members.find(
      (member) =>
        member.userId === userId &&
        member.workspaceId === workspaceId
    );

    if (!existingMember) {
      this.data.members.push({
        id: `member-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 7)}`,

        userId,

        workspaceId,

        role: 'MEMBER',

        joinedAt: new Date().toISOString(),
      });

      this.save(true);
    }

    return workspace;
  }

  public async joinWorkspaceByInvite(
    inviteCode: string,
    userId: string
  ): Promise<Workspace | null> {
    const cleanCode = inviteCode.trim().toLowerCase();

    const workspace = this.data.workspaces.find(
      (item) =>
        item.inviteCode.trim().toLowerCase() === cleanCode
    );

    if (!workspace) {
      return null;
    }

    const existingMember = this.data.members.find(
      (member) =>
        member.userId === userId &&
        member.workspaceId === workspace.id
    );

    if (!existingMember) {
      this.data.members.push({
        id: `member-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 7)}`,

        userId,

        workspaceId: workspace.id,

        role: 'MEMBER',

        joinedAt: new Date().toISOString(),
      });

      this.save(true);
    }

    return workspace;
  }

  public async getWorkspaceByInviteCode(
    inviteCode: string
  ): Promise<Workspace | undefined> {
    const cleanCode = inviteCode.trim().toLowerCase();

    return this.data.workspaces.find(
      (workspace) =>
        workspace.inviteCode.trim().toLowerCase() === cleanCode
    );
  }

  public async addChannel(
    workspaceId: string,
    name: string
  ): Promise<Channel | undefined> {
    const workspace = this.data.workspaces.find(
      (item) => item.id === workspaceId
    );

    if (!workspace) {
      return undefined;
    }

    const channel: Channel = {
      id: `ch-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`,

      name: name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-'),

      workspaceId,

      isPrivate: false,

      createdAt: new Date().toISOString(),
    };

    workspace.channels.push(channel);

    this.save(true);

    return channel;
  }

  // ============================================================
  // MESSAGES
  // ============================================================

  public async getChannelMessages(
    channelId: string
  ): Promise<Message[]> {
    return this.data.messages.filter(
      (message) => message.channelId === channelId
    );
  }

  public async getDirectMessages(
    userId1: string,
    userId2: string
  ): Promise<Message[]> {
    return this.data.messages.filter(
      (message) =>
        (message.senderId === userId1 &&
          message.recipientId === userId2) ||
        (message.senderId === userId2 &&
          message.recipientId === userId1)
    );
  }

  public async getUnreadMessagesForUser(
    userId: string
  ): Promise<Message[]> {
    return this.data.messages.filter(
      (message) =>
        message.recipientId === userId &&
        !message.isRead
    );
  }

  public async markMessagesAsRead(
    senderId: string,
    recipientId: string
  ): Promise<void> {
    let updated = false;

    for (const message of this.data.messages) {
      if (
        message.senderId === senderId &&
        message.recipientId === recipientId &&
        !message.isRead
      ) {
        message.isRead = true;
        updated = true;
      }
    }

    if (updated) {
      this.save();
    }
  }

  public async saveMessage(
    message: Omit<Message, 'id' | 'createdAt' | 'isRead'>
  ): Promise<Message> {
    const newMessage: Message = {
      ...message,

      id: `msg-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`,

      isRead: false,

      createdAt: new Date().toISOString(),
    };

    this.data.messages.push(newMessage);

    this.save();

    return newMessage;
  }

  // ============================================================
  // CALL LOGS
  // ============================================================

  public async logCall(
    log: Omit<CallLog, 'id'>
  ): Promise<CallLog> {
    const newLog: CallLog = {
      ...log,

      id: `call-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`,
    };

    this.data.callLogs.unshift(newLog);

    if (this.data.callLogs.length > 50) {
      this.data.callLogs.pop();
    }

    this.save();

    return newLog;
  }

  public async getCallLogs(): Promise<CallLog[]> {
    return this.data.callLogs;
  }
}

export const db = new DatabaseService();