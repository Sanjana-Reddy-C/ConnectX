import React, { useState } from 'react';
import { api } from '../services/api.js';
import { Channel } from '../types/index.js';
import { X, Hash } from 'lucide-react';

interface AddChannelModalProps {
  workspaceId: string;
  onClose: () => void;
  onChannelAdded: (channel: Channel) => void;
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({
  workspaceId,
  onClose,
  onChannelAdded,
}) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.addChannel(workspaceId, name.trim());
      onChannelAdded(res.channel);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Hash className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Create New Channel</h3>
            <p className="text-[11px] text-slate-400">Organize communication topics & calling groups</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Channel Name</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. dev-standup or product-review"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white transition cursor-pointer"
          >
            {loading ? 'Creating...' : 'Create Channel'}
          </button>
        </form>
      </div>
    </div>
  );
};
