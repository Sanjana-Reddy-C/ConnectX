import React, { useState } from 'react';
import {
  Phone,
  Video,
  X,
  Search,
  Loader2,
  UserRound,
} from 'lucide-react';

import { api } from '../services/api.js';

interface PhoneCallModalProps {
  onClose: () => void;

  onCallStarted?: (data: {
    callId: string;
    roomId: string;
    type: 'VOICE' | 'VIDEO';
    receiverId: string;
    receiverName: string;
  }) => void;
}

const PhoneCallModal: React.FC<
  PhoneCallModalProps
> = ({
  onClose,
  onCallStarted,
}) => {
  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [type, setType] =
    useState<'VOICE' | 'VIDEO'>(
      'VOICE'
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [receiver, setReceiver] =
    useState<{
      id: string;
      name: string;
      phoneNumber?: string;
    } | null>(null);

  const [searching, setSearching] =
    useState(false);

  const cleanPhone = () =>
    phoneNumber
      .trim()
      .replace(/[^\d+]/g, '');

  const findUser = async () => {
    const phone = cleanPhone();

    if (!phone) {
      setError(
        'Enter a ConnectX phone number'
      );
      return;
    }

    setError('');
    setSearching(true);
    setReceiver(null);

    try {
      const result =
        await api.findUserByPhone(phone);

      setReceiver(result.user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'ConnectX user not found'
      );
    } finally {
      setSearching(false);
    }
  };

  const startCall = async () => {
    const phone = cleanPhone();

    if (!phone) {
      setError(
        'Enter a ConnectX phone number'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result =
        await api.initiateCall({
          phoneNumber: phone,
          type,
        });

      if (
        !result.call.receiverOnline
      ) {
        setError(
          `${result.call.receiverName} is not currently connected to ConnectX. The mobile app needs to be running or push notifications need to be configured.`
        );

        setLoading(false);
        return;
      }

      onCallStarted?.({
        callId:
          result.call.callId,

        roomId:
          result.call.roomId,

        type:
          result.call.type,

        receiverId:
          result.call.receiverId,

        receiverName:
          result.call.receiverName,
      });

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start call'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">

        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Call ConnectX User
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Enter their registered ConnectX phone number
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-6">

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Phone Number
            </label>

            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(
                    e.target.value
                  );
                  setReceiver(null);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter'
                  ) {
                    findUser();
                  }
                }}
                placeholder="+91 98765 43210"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-500"
              />

              <button
                onClick={findUser}
                disabled={searching}
                className="rounded-xl bg-slate-800 px-4 text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {searching ? (
                  <Loader2
                    size={20}
                    className="animate-spin"
                  />
                ) : (
                  <Search size={20} />
                )}
              </button>
            </div>
          </div>

          {receiver && (
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600">
                  <UserRound
                    size={21}
                    className="text-white"
                  />
                </div>

                <div>
                  <p className="font-medium text-white">
                    {receiver.name}
                  </p>

                  <p className="text-sm text-slate-400">
                    {receiver.phoneNumber ||
                      phoneNumber}
                  </p>
                </div>

              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">
              Call Type
            </p>

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() =>
                  setType('VOICE')
                }
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition ${
                  type === 'VOICE'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                }`}
              >
                <Phone size={18} />
                Voice
              </button>

              <button
                onClick={() =>
                  setType('VIDEO')
                }
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition ${
                  type === 'VIDEO'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
                }`}
              >
                <Video size={18} />
                Video
              </button>

            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={startCall}
            disabled={
              loading ||
              !phoneNumber.trim()
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Calling...
              </>
            ) : type === 'VOICE' ? (
              <>
                <Phone size={18} />
                Call User
              </>
            ) : (
              <>
                <Video size={18} />
                Start Video Call
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
};

export default PhoneCallModal;