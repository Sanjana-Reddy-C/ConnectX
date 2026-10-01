import React from 'react';
import { Workspace, Channel, User } from '../types/index.js';
import { Hash, Plus, Users, Video, Phone, Copy, Check, Briefcase } from 'lucide-react';
import PhoneCallModal from './PhoneCallModal';
interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace) => void;
  activeChannel: Channel | null;
  onSelectChannel: (ch: Channel) => void;
  users: User[];
  activeDirectUser: User | null;
  onSelectDirectUser: (user: User) => void;
  onOpenNewWorkspaceModal: () => void;
  onOpenAddChannelModal: () => void;
  onStartDirectCall: (targetUser: User, type: 'VOICE' | 'VIDEO') => void;
  currentUserId: string;
  onlineUsersMap: Map<string, 'online' | 'offline'>;
  unreadCountByUser: Record<string, number>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  activeChannel,
  onSelectChannel,
  users,
  activeDirectUser,
  onSelectDirectUser,
  onOpenNewWorkspaceModal,
  onOpenAddChannelModal,
  onStartDirectCall,
  currentUserId,
  onlineUsersMap,
  unreadCountByUser,
}) => {
  const [copiedCode, setCopiedCode] = React.useState(false);

  const handleCopyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const otherUsers = users.filter((u) => u.id !== currentUserId);

  return (
    <aside className="w-64 sm:w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Workspace Header & Switcher */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-white truncate">
              {activeWorkspace?.name || 'Workspace'}
            </span>
          </div>
          <button
            onClick={onOpenNewWorkspaceModal}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Create or Join Workspace"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {activeWorkspace && (
          <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-slate-800/60 border border-slate-800 text-slate-400">
            <span className="truncate">Invite: <code className="text-cyan-400 font-mono">{activeWorkspace.inviteCode}</code></span>
            <button
              onClick={() => handleCopyInvite(activeWorkspace.inviteCode)}
              className="hover:text-cyan-300 transition ml-1 cursor-pointer"
              title="Copy invite code"
            >
              {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        )}

        {/* Workspace dropdown if multiple exist */}
        {workspaces.length > 1 && (
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {workspaces.map((ws, idx) => (
              <button
                key={`${ws.id}-${idx}`}
                onClick={() => onSelectWorkspace(ws)}
                className={`text-[10px] px-2 py-0.5 rounded font-medium truncate max-w-[120px] transition cursor-pointer ${
                  activeWorkspace?.id === ws.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {ws.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Content: Channels & Direct Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
        {/* Workspace Channels */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Channels
            </span>
            <button
              onClick={onOpenAddChannelModal}
              className="text-slate-400 hover:text-white transition cursor-pointer"
              title="Add Channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {activeWorkspace?.channels && activeWorkspace.channels.length > 0 ? (
              activeWorkspace.channels.map((channel) => {
                const isSelected = activeChannel?.id === channel.id && !activeDirectUser;
                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel(channel)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-cyan-400'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5 text-slate-500" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                );
              })
            ) : (
              <div className="text-[11px] text-slate-500 px-2.5 py-1">No channels yet</div>
            )}
          </div>
        </div>

        {/* Direct Messages & Users */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Direct Messages ({otherUsers.length})
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {otherUsers.length > 0 ? (
              otherUsers.map((targetUser) => {
                const isSelected = activeDirectUser?.id === targetUser.id;
                const presence = onlineUsersMap.get(targetUser.id) || targetUser.status || 'offline';
                const isOnline = presence === 'online';
                const unread = unreadCountByUser[targetUser.id] || 0;

                return (
                  <div
                    key={targetUser.id}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div
                      onClick={() => onSelectDirectUser(targetUser)}
                      className="flex items-center gap-2 min-w-0 flex-1"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={targetUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(targetUser.name)}`}
                          alt={targetUser.name}
                          className="w-6 h-6 rounded-full bg-slate-800 object-cover"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                            isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <span className="truncate font-medium">{targetUser.name}</span>
                      {unread > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500 text-[10px] text-white font-bold">
                          {unread}
                        </span>
                      )}
                    </div>

                    {/* Quick Call Actions */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartDirectCall(targetUser, 'VOICE');
                        }}
                        className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 transition"
                        title={`Voice call ${targetUser.name}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartDirectCall(targetUser, 'VIDEO');
                        }}
                        className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-700/60 transition"
                        title={`Video call ${targetUser.name}`}
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-[11px] text-slate-500 px-2.5 py-1">
                Open another tab or use the demo switchers to test calling & messaging!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global IP Calling Footer Hint */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>Internet P2P Ready</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-0.5">Calls connect worldwide via WebRTC IP networking without phone numbers or cellular fees.</p>
      </div>
    </aside>
  );
};
