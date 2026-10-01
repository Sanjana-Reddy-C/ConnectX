import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { CallLog } from '../types/index.js';
import { X, Phone, Video, Users, Clock, History } from 'lucide-react';

interface CallHistoryModalProps {
  onClose: () => void;
}

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCallHistory()
      .then((res) => {
        setLogs(res.logs);
      })
      .catch((e) => console.warn('Failed to load call history:', e))
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Call Logs & History</h3>
            <p className="text-[11px] text-slate-400">Internet IP voice and video communication history</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading call history...</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-400">No calls recorded yet</p>
              <p>Start a voice or video call with any contact or conference room.</p>
            </div>
          ) : (
            logs.map((log) => {
              const dateStr = new Date(log.startedAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        log.type === 'VIDEO'
                          ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {log.type === 'VIDEO' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>{log.initiatorName}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                          {log.roomId}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {dateStr}
                        </span>
                        <span>•</span>
                        <span>Duration: <strong className="text-slate-200">{formatDuration(log.duration)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{log.participants.length}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
