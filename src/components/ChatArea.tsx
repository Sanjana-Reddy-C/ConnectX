import React, { useState, useEffect, useRef } from 'react';
import { Channel, User, Message } from '../types/index.js';
import { Phone, Video, Send, Hash, ShieldAlert, Sparkles } from 'lucide-react';

interface ChatAreaProps {
  activeChannel: Channel | null;
  activeDirectUser: User | null;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onStartCall: (type: 'VOICE' | 'VIDEO') => void;
  isRecipientOnline: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChannel,
  activeDirectUser,
  messages,
  currentUserId,
  onSendMessage,
  onStartCall,
  isRecipientOnline,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const title = activeDirectUser
    ? activeDirectUser.name
    : activeChannel
    ? `#${activeChannel.name}`
    : 'Select a conversation';

  const subtitle = activeDirectUser
    ? isRecipientOnline
      ? 'Online • Ready for IP Voice/Video Call'
      : 'Offline • Messages will be delivered via Offline Store'
    : activeChannel
    ? 'Channel workspace collaboration'
    : '';

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {activeDirectUser ? (
            <div className="relative">
              <img
                src={activeDirectUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(activeDirectUser.name)}`}
                alt={activeDirectUser.name}
                className="w-10 h-10 rounded-full bg-slate-800 object-cover border border-slate-700"
              />
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                  isRecipientOnline ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400 border border-slate-700">
              <Hash className="w-5 h-5" />
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              {title}
            </h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        {/* Voice and Video Calling Buttons */}
        {(activeDirectUser || activeChannel) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStartCall('VOICE')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
              title="Start Internet Voice Call"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voice Call</span>
            </button>
            <button
              onClick={() => onStartCall('VIDEO')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer shadow-sm"
              title="Start Internet Video Call"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Call</span>
            </button>
          </div>
        )}
      </div>

      {/* Offline Message Informational Banner */}
      {activeDirectUser && !isRecipientOnline && (
        <div className="px-6 py-2 bg-indigo-950/40 border-b border-indigo-900/40 flex items-center gap-2 text-xs text-indigo-300">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Offline Message Feature Active:</strong> {activeDirectUser.name} is currently offline. Any message sent will be securely stored in PostgreSQL and delivered the moment they log in.
          </span>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">No messages yet in this conversation</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Send a real-time message, or use the buttons in the top right to start a high-definition internet voice or video call.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <img
                  src={
                    msg.senderAvatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`
                  }
                  alt={msg.senderName}
                  className="w-8 h-8 rounded-full bg-slate-800 object-cover border border-slate-700 shrink-0 mt-0.5"
                />

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-300">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-500">{timeStr}</span>
                  </div>

                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm ${
                      isMe
                        ? 'bg-cyan-600 text-white rounded-tr-none'
                        : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/60'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              activeDirectUser
                ? !isRecipientOnline
                  ? `Leave an offline message for ${activeDirectUser.name}...`
                  : `Message ${activeDirectUser.name}...`
                : activeChannel
                ? `Message #${activeChannel.name}...`
                : 'Select a conversation...'
            }
            className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </main>
  );
};
