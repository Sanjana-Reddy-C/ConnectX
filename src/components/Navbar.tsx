import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Globe, PhoneCall, ShieldCheck, LogOut, User as UserIcon, Share2, Check } from 'lucide-react';
import PhoneCallModal from './PhoneCallModal';
interface NavbarProps {
  onOpenCallHistory: () => void;
  onOpenActiveCallQuick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCallHistory, onOpenActiveCallQuick }) => {
  const { user, logout, switchDemoUser } = useAuth();
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  const handleCopyAppUrl = () => {
    // Copy the clean web URL (origin + pathname) so the other laptop can open it directly
    const url = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(url);
    setCopiedAppUrl(true);
    setTimeout(() => setCopiedAppUrl(false), 2500);
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-5 flex items-center justify-between z-30 shrink-0">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/20">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-white">Connect<span className="text-cyan-400">X</span></span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
              Enterprise IP
            </span>
          </div>
          <p className="text-[11px] text-slate-400">WebRTC Internet Calling & Team Collaboration</p>
        </div>
      </div>

      {/* Connectivity & Fast Actions */}
      <div className="flex items-center gap-3">
        {/* STUN/TURN Network Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>STUN/TURN Active (No Cellular Required)</span>
        </div>

        {/* Share App Link Button */}
        <button
          onClick={handleCopyAppUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700/80 transition-colors shadow-sm cursor-pointer"
          title="Copy web link to open on another laptop or send to someone on another Wi-Fi network"
        >
          {copiedAppUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-cyan-400" />}
          <span>{copiedAppUrl ? 'App Link Copied!' : 'Invite Other Laptop'}</span>
        </button>

        {/* Call Conference Room Button */}
        <button
          onClick={onOpenActiveCallQuick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
          title="Open Conference Video Room"
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Instant Video Room</span>
        </button>

        {/* Call Logs */}
        <button
          onClick={onOpenCallHistory}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition-colors cursor-pointer"
        >
          Call Logs
        </button>

        {/* Demo Account Quick Switcher */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-lg border border-slate-700/50">
          <span className="text-[10px] uppercase font-semibold text-slate-400 px-1.5">Switch Demo:</span>
          <button
            onClick={() => switchDemoUser(1)}
            className="text-xs px-2 py-0.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Switch to Elena (UK)"
          >
            Elena (UK)
          </button>
          <button
            onClick={() => switchDemoUser(2)}
            className="text-xs px-2 py-0.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Switch to Kenji (Tokyo)"
          >
            Kenji (JP)
          </button>
          <button
            onClick={() => switchDemoUser(3)}
            className="text-xs px-2 py-0.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            title="Switch to Marcus (NY)"
          >
            Marcus (US)
          </button>
        </div>

        {/* User Profile */}
        {user ? (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-slate-800"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900"></span>
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
                <div className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px]">{user.email}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Guest</span>
          </div>
        )}
      </div>
    </header>
  );
};
