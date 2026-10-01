import {
  User,
  Workspace,
  Message,
  CallLog,
  WebRtcConfig,
} from '../types/index.js';

function getAuthHeader(): Record<string, string> {
  const token =
    localStorage.getItem('connectx_token');

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

async function parseError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = await response.json();

    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export const api = {
  // ============================================================
  // AUTH
  // ============================================================

  async register(data: {
    name: string;
    email: string;
    password: string;
    phoneNumber?: string;
  }): Promise<{
    user: User;
    token: string;
  }> {
    const res = await fetch(
      '/api/auth/register',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Registration failed'
        )
      );
    }

    return res.json();
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<{
    user: User;
    token: string;
  }> {
    const res = await fetch(
      '/api/auth/login',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Login failed'
        )
      );
    }

    return res.json();
  },

  async getMe(): Promise<{
    user: User;
  }> {
    const res = await fetch(
      '/api/auth/me',
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Session invalid'
        )
      );
    }

    return res.json();
  },

  async getAllUsers(): Promise<{
    users: User[];
  }> {
    const res = await fetch(
      '/api/users',
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch users'
        )
      );
    }

    return res.json();
  },

  async findUserByPhone(
    phoneNumber: string
  ): Promise<{
    user: User;
  }> {
    const res = await fetch(
      `/api/users/by-phone?phoneNumber=${encodeURIComponent(
        phoneNumber
      )}`,
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'No ConnectX user found with this phone number'
        )
      );
    }

    return res.json();
  },

  // ============================================================
  // WORKSPACES
  // ============================================================

  async getWorkspaces(): Promise<{
    workspaces: Workspace[];
  }> {
    const res = await fetch(
      '/api/workspaces',
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch workspaces'
        )
      );
    }

    return res.json();
  },

  async createWorkspace(
    name: string,
    description?: string
  ): Promise<{
    workspace: Workspace;
  }> {
    const res = await fetch(
      '/api/workspaces',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          ...getAuthHeader(),
        },

        body: JSON.stringify({
          name,
          description,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to create workspace'
        )
      );
    }

    return res.json();
  },

  async joinWorkspace(
    inviteCode: string
  ): Promise<{
    workspace: Workspace;
  }> {
    const res = await fetch(
      '/api/workspaces/join',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          ...getAuthHeader(),
        },

        body: JSON.stringify({
          inviteCode,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to join workspace'
        )
      );
    }

    return res.json();
  },

  async addChannel(
    workspaceId: string,
    name: string
  ): Promise<{
    channel: any;
  }> {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/channels`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          ...getAuthHeader(),
        },

        body: JSON.stringify({
          name,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to add channel'
        )
      );
    }

    return res.json();
  },

  // ============================================================
  // MESSAGES
  // ============================================================

  async getChannelMessages(
    channelId: string
  ): Promise<{
    messages: Message[];
  }> {
    const res = await fetch(
      `/api/messages/channel/${channelId}`,
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch channel messages'
        )
      );
    }

    return res.json();
  },

  async getDirectMessages(
    targetUserId: string
  ): Promise<{
    messages: Message[];
  }> {
    const res = await fetch(
      `/api/messages/direct/${targetUserId}`,
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch direct messages'
        )
      );
    }

    return res.json();
  },

  async getUnreadMessages(): Promise<{
    unreadMessages: Message[];
    count: number;
  }> {
    const res = await fetch(
      '/api/messages/unread',
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch unread messages'
        )
      );
    }

    return res.json();
  },

  // ============================================================
  // WEBRTC
  // ============================================================

  async getWebRtcConfig(): Promise<{
    config: WebRtcConfig;
  }> {
    const res = await fetch(
      '/api/calls/config'
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch WebRTC config'
        )
      );
    }

    return res.json();
  },

  // ============================================================
  // CALL LOGS
  // ============================================================

  async logCall(data: {
    roomId: string;
    type: 'VOICE' | 'VIDEO';
    status:
      | 'COMPLETED'
      | 'MISSED'
      | 'REJECTED';
    duration: number;
    participants: string[];
  }): Promise<{
    log: CallLog;
  }> {
    const res = await fetch(
      '/api/calls/log',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          ...getAuthHeader(),
        },

        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to log call'
        )
      );
    }

    return res.json();
  },

  async getCallHistory(): Promise<{
    logs: CallLog[];
  }> {
    const res = await fetch(
      '/api/calls/history',
      {
        headers: {
          ...getAuthHeader(),
        },
      }
    );

    if (!res.ok) {
      throw new Error(
        await parseError(
          res,
          'Failed to fetch call history'
        )
      );
    }

    return res.json();
  },
  async initiateCall(data: {
  phoneNumber: string;
  type: 'VOICE' | 'VIDEO';
}): Promise<{
  success: boolean;
  call: {
    callId: string;
    roomId: string;
    type: 'VOICE' | 'VIDEO';
    receiverId: string;
    receiverName: string;
    phoneNumber?: string;
    receiverOnline: boolean;
  };
}> {
  const res = await fetch(
    '/api/calls/initiate',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },

      body: JSON.stringify(data),
    }
  );

  const dataResponse =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      dataResponse.error ||
        'Failed to initiate call'
    );
  }

  return dataResponse;
},

async acceptCall(
  callId: string
) {
  const res = await fetch(
    '/api/calls/accept',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },

      body: JSON.stringify({
        callId,
      }),
    }
  );

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
        'Failed to accept call'
    );
  }

  return data;
},

async rejectCall(
  callId: string
) {
  const res = await fetch(
    '/api/calls/reject',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },

      body: JSON.stringify({
        callId,
      }),
    }
  );

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
        'Failed to reject call'
    );
  }

  return data;
},

async endCall(
  callId: string
) {
  const res = await fetch(
    '/api/calls/end',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },

      body: JSON.stringify({
        callId,
      }),
    }
  );

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ||
        'Failed to end call'
    );
  }

  return data;
},
};