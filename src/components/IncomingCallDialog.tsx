import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface IncomingCallDialogProps {
  caller: { id: string; name: string; avatarUrl?: string };
  type: 'VOICE' | 'VIDEO';
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({
  caller,
  type,
  onAccept,
  onDecline,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center space-y-5">
        <div className="relative">
          <img
            src={
              caller.avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(caller.name)}`
            }
            alt={caller.name}
            className="w-20 h-20 rounded-full border-4 border-cyan-500/60 bg-slate-800 object-cover shadow-lg"
          />
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 ring-4 ring-slate-900 flex items-center justify-center">
            {type === 'VIDEO' ? <Video className="w-3.5 h-3.5 text-white" /> : <Phone className="w-3.5 h-3.5 text-white" />}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">{caller.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Incoming Internet {type === 'VIDEO' ? 'Video' : 'Voice'} Call (WebRTC IP)
          </p>
        </div>

        <div className="flex items-center gap-4 w-full justify-center pt-2">
          {/* Decline Button */}
          <button
            onClick={onDecline}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition cursor-pointer"
            title="Decline Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 transition cursor-pointer animate-pulse"
            title="Accept Call"
          >
            {type === 'VIDEO' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
