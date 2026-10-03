import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Socket } from 'socket.io-client';

import {
  WebRtcManager,
  RemoteParticipant,
} from '../services/webrtc.js';

import { api } from '../services/api.js';

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  ShieldCheck,
  Users,
  Radio,
  Share2,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

interface CallModalProps {
  roomId: string;
  socket: Socket;
  currentUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  initialType?: 'VOICE' | 'VIDEO';
  onEndCall: () => void;
}

export const CallModal: React.FC<
  CallModalProps
> = ({
  roomId,
  socket,
  currentUser,
  initialType = 'VIDEO',
  onEndCall,
}) => {
  const managerRef =
  useRef<WebRtcManager | null>(null);

  const [localStream, setLocalStream] =
    useState<MediaStream | null>(null);

  const [
    screenShareStream,
    setScreenShareStream,
  ] = useState<MediaStream | null>(null);

  const [
    participants,
    setParticipants,
  ] = useState<RemoteParticipant[]>([]);

  const [
    connectionState,
    setConnectionState,
  ] = useState<string>('connecting');

  const [isMuted, setIsMuted] =
    useState(false);

  const [isCameraOff, setIsCameraOff] =
    useState(initialType === 'VOICE');

  const [
    isScreenSharing,
    setIsScreenSharing,
  ] = useState(false);

  const [micVolume, setMicVolume] =
    useState(0);

  const [callDuration, setCallDuration] =
    useState(0);

  const [copiedLink, setCopiedLink] =
    useState(false);

  const localVideoRef =
    useRef<HTMLVideoElement>(null);

  const screenVideoRef =
    useRef<HTMLVideoElement>(null);

  const handleCopyCallLink = () => {
    const origin =
      window.location.origin;

    const url = new URL(origin);

    url.searchParams.set(
      'callRoom',
      roomId
    );

    url.searchParams.set(
      'callType',
      initialType
    );

    navigator.clipboard
      .writeText(url.toString())
      .then(() => {
        setCopiedLink(true);

        setTimeout(
          () => setCopiedLink(false),
          2500
        );
      })
      .catch((error) => {
        console.error(
          'Failed to copy call link:',
          error
        );
      });
  };

  /*
   * Local microphone activity
   */
  useEffect(() => {
    if (!localStream || isMuted) {
      setMicVolume(0);
      return;
    }

    const audioTrack =
      localStream.getAudioTracks()[0];

    if (!audioTrack) return;

    let audioCtx:
      | AudioContext
      | null = null;

    let analyser:
      | AnalyserNode
      | null = null;

    let source:
      | MediaStreamAudioSourceNode
      | null = null;

    let animId = 0;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as any)
          .webkitAudioContext;

      if (AudioCtxClass) {
        audioCtx =
          new AudioCtxClass();

        analyser =
          audioCtx.createAnalyser();

        analyser.fftSize = 64;

        const tempStream =
          new MediaStream([
            audioTrack,
          ]);

        source =
          audioCtx.createMediaStreamSource(
            tempStream
          );

        source.connect(analyser);

        const dataArray =
          new Uint8Array(
            analyser.frequencyBinCount
          );

        const loop = () => {
          if (!analyser) return;

          analyser.getByteFrequencyData(
            dataArray
          );

          let sum = 0;

          for (
            let i = 0;
            i < dataArray.length;
            i++
          ) {
            sum += dataArray[i];
          }

          const avg =
            sum / dataArray.length;

          setMicVolume(
            Math.min(
              100,
              Math.round(
                (avg / 128) * 100
              )
            )
          );

          animId =
            requestAnimationFrame(loop);
        };

        loop();
      }
    } catch (error) {
      console.warn(
        '[WebRTC] Audio visualizer error:',
        error
      );
    }

    return () => {
      if (animId) {
        cancelAnimationFrame(animId);
      }

      source?.disconnect();
      analyser?.disconnect();

      audioCtx
        ?.close()
        .catch(() => {});
    };
  }, [
    localStream,
    isMuted,
  ]);

  /*
 * Initialize WebRTC
 *
 * Keep exactly one WebRtcManager instance for
 * the lifetime of this call.
 */
useEffect(() => {
  let isMounted = true;

  const rtcManager =
    new WebRtcManager(
      socket,
      currentUser
    );

  managerRef.current =
    rtcManager;

  rtcManager.onParticipantsUpdate =
    (updatedParticipants) => {
      if (!isMounted) {
        return;
      }

      setParticipants([
        ...updatedParticipants,
      ]);
    };

  rtcManager.onConnectionStateChange =
    (state) => {
      if (!isMounted) {
        return;
      }

      setConnectionState(state);
    };

  rtcManager.onScreenShareStateChange =
    (
      sharing,
      stream
    ) => {
      if (!isMounted) {
        return;
      }

      setIsScreenSharing(
        sharing
      );

      setScreenShareStream(
        stream
      );
    };

  rtcManager
    .initialize(
      roomId,
      initialType === 'VOICE'
    )
    .then((stream) => {
      if (!isMounted) {
        return;
      }

      setLocalStream(stream);
    })
    .catch((error) => {
      if (!isMounted) {
        return;
      }

      console.error(
        '[CallModal] Failed to initialize WebRTC:',
        error
      );
    });

  const timer =
    setInterval(() => {
      if (!isMounted) {
        return;
      }

      setCallDuration(
        (previous) =>
          previous + 1
      );
    }, 1000);

  return () => {
    isMounted = false;

    clearInterval(timer);

    /*
     * Only clean up the manager that belongs
     * to this CallModal instance.
     */
    if (
      managerRef.current ===
      rtcManager
    ) {
      rtcManager.leave();

      managerRef.current =
        null;
    }
  };
}, [
  roomId,
  socket,
  currentUser.id,
  currentUser.name,
  currentUser.avatarUrl,
  initialType,
]);

  /*
   * Local camera preview
   */
  useEffect(() => {
  if (
    localVideoRef.current &&
    localStream
  ) {
    localVideoRef.current.srcObject =
      localStream;

    localVideoRef.current
      .play()
      .catch(() => {});
  }
}, [localStream, isScreenSharing]);

  /*
   * Screen-share preview
   */
  useEffect(() => {
    if (
      screenVideoRef.current &&
      screenShareStream
    ) {
      screenVideoRef.current.srcObject =
        screenShareStream;

      screenVideoRef.current
        .play()
        .catch(() => {});
    }
  }, [screenShareStream]);

  const formatTime = (
    seconds: number
  ) => {
    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    return `${minutes
      .toString()
      .padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
  const manager =
    managerRef.current;

  if (!manager) {
    return;
  }

  const nextState =
    !isMuted;

  manager.toggleMute(
    nextState
  );

  setIsMuted(nextState);
};

  const handleToggleCamera = () => {
  const manager =
    managerRef.current;

  if (!manager) {
    return;
  }

  const nextState =
    !isCameraOff;

  manager.toggleCamera(
    nextState
  );

  setIsCameraOff(
    nextState
  );
};

  const handleToggleScreenShare =
  async () => {
    const manager =
      managerRef.current;

    if (!manager) {
      return;
    }

      if (isScreenSharing) {
        manager.stopScreenShare();

        setIsScreenSharing(
          false
        );

        setScreenShareStream(
          null
        );

        return;
      }

      const screen =
        await manager.startScreenShare();

      if (screen) {
        setScreenShareStream(
          screen
        );

        setIsScreenSharing(
          true
        );
      }
    };

  const handleLeaveCall =
  async () => {
    const manager =
      managerRef.current;

    if (manager) {
      manager.leave();

      managerRef.current =
        null;
    }

      try {
        await api.logCall({
          roomId,
          type:
            initialType === 'VOICE'
              ? 'VOICE'
              : 'VIDEO',
          status: 'COMPLETED',
          duration:
            callDuration,
          participants: [
            currentUser.name,
            ...participants.map(
              (p) =>
                p.user.name
            ),
          ],
        });
      } catch (error) {
        console.warn(
          'Failed to save call log:',
          error
        );
      }

      onEndCall();
    };

  const connectionLabel =
    connectionState ===
    'connected'
      ? 'Connected'
      : connectionState ===
        'connecting'
      ? 'Connecting'
      : connectionState;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none overflow-hidden animate-in fade-in duration-200">

      {/* HEADER */}
      <header className="h-16 px-6 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4 min-w-0">

          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />

            <h1 className="text-sm font-semibold text-white tracking-wide">
              ConnectX Video Call
            </h1>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />

            <span>
              WebRTC P2P
            </span>

            <span className="text-slate-500">
              /
            </span>

            <span
              className={
                connectionState ===
                'connected'
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }
            >
              {connectionLabel}
            </span>
          </div>

          <div className="hidden xl:block text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700 truncate max-w-[360px]">
            Room:{' '}
            <span className="text-cyan-300 font-mono font-medium">
              {roomId}
            </span>
          </div>

          <button
            onClick={
              handleCopyCallLink
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition cursor-pointer shadow-sm shrink-0"
            title="Copy shareable call link"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}

            <span className="hidden sm:inline">
              {copiedLink
                ? 'Link Copied!'
                : 'Share Call Link'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono font-semibold text-white">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />

            <span>
              {formatTime(
                callDuration
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <Users className="w-3.5 h-3.5 text-slate-400" />

            <span>
              {participants.length +
                1}{' '}
              participant
              {participants.length +
                1 >
              1
                ? 's'
                : ''}
            </span>
          </div>
        </div>
      </header>

      {/* VIDEO STAGE */}
      <main className="flex-1 min-h-0 p-4 bg-slate-950 overflow-hidden">

        {isScreenSharing &&
        screenShareStream ? (
          /*
           * SCREEN SHARING LAYOUT
           */
          <div className="w-full h-full max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">

            {/* MAIN SCREEN SHARE */}
            <div className="relative min-h-0 rounded-2xl overflow-hidden bg-slate-900 border border-cyan-500/30 shadow-2xl">

              <video
                ref={
                  screenVideoRef
                }
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />

              {/* Screen sharing label */}
              <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-lg bg-cyan-600/95 backdrop-blur text-white text-xs font-semibold shadow-lg flex items-center gap-2">
                <ScreenShare className="w-4 h-4" />

                <span>
                  You are sharing your screen
                </span>
              </div>

              {/* Screen share info */}
              <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur border border-slate-700 text-xs text-slate-200">
                Your screen is being shared with the call
              </div>

              {/* LOCAL CAMERA PIP */}
              <div className="absolute right-5 bottom-5 z-30 w-[220px] h-[135px] sm:w-[260px] sm:h-[155px] rounded-xl overflow-hidden border-2 border-slate-600 bg-slate-900 shadow-2xl">

                {!isCameraOff &&
                localStream?.getVideoTracks()
                  .length ? (
                  <video
                    ref={
                      localVideoRef
                    }
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900">
                    <img
                      src={
                        currentUser.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          currentUser.name
                        )}`
                      }
                      alt={
                        currentUser.name
                      }
                      className="w-12 h-12 rounded-full border border-slate-700"
                    />

                    <span className="mt-2 text-[10px] text-slate-300">
                      Camera Off
                    </span>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-slate-950/80 text-[10px] text-white">
                  {currentUser.name}{' '}
                  (You)
                </div>
              </div>
            </div>

            {/* REMOTE PARTICIPANTS */}
            <div className="min-h-0 flex flex-col gap-4 overflow-y-auto">

              {participants.length ===
              0 ? (
                <div className="h-full min-h-[260px] rounded-2xl border border-slate-800 bg-slate-900 flex items-center justify-center text-center p-6">
                  <div>
                    <Users className="w-8 h-8 text-slate-500 mx-auto mb-3" />

                    <p className="text-sm font-medium text-white">
                      Waiting for participant
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Share the call link to invite someone.
                    </p>
                  </div>
                </div>
              ) : (
                participants.map(
                  (peer) => (
                    <RemoteVideoTile
                      key={
                        peer.socketId
                      }
                      participant={
                        peer
                      }
                      compact
                    />
                  )
                )
              )}
            </div>
          </div>
        ) : (
          /*
           * NORMAL CALL LAYOUT
           */
          <div
            className={`w-full h-full max-w-[1500px] mx-auto grid gap-4 items-center justify-center ${
              participants.length ===
              0
                ? 'grid-cols-1'
                : participants.length ===
                  1
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}
          >

            {/* LOCAL VIDEO */}
            <LocalVideoTile
              stream={
                localStream
              }
              currentUser={
                currentUser
              }
              isCameraOff={
                isCameraOff
              }
              isMuted={
                isMuted
              }
              micVolume={
                micVolume
              }
              videoRef={
                localVideoRef
              }
            />

            {/* REMOTE PARTICIPANTS */}
            {participants.map(
              (peer) => (
                <RemoteVideoTile
                  key={
                    peer.socketId
                  }
                  participant={
                    peer
                  }
                />
              )
            )}
          </div>
        )}
      </main>

      {/* WAITING MESSAGE */}
      {participants.length ===
        0 &&
        !isScreenSharing && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 max-w-lg w-[90%] px-4 py-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 text-xs text-slate-300 backdrop-blur shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 z-40">

            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />

              <div>
                <p className="font-semibold text-white">
                  Waiting for someone to connect
                </p>

                <p className="text-[11px] text-slate-400">
                  Open the copied room link on another device.
                </p>
              </div>
            </div>

            <button
              onClick={
                handleCopyCallLink
              }
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer text-xs"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}

              <span>
                {copiedLink
                  ? 'Link Copied!'
                  : 'Copy Room Link'}
              </span>
            </button>
          </div>
        )}

      {/* CONTROLS */}
      <footer className="h-20 bg-slate-900/95 border-t border-slate-800 px-6 flex items-center justify-center gap-4 z-30 shrink-0">

        {/* MUTE */}
        <button
          onClick={
            handleToggleMute
          }
          className={`p-3.5 rounded-2xl transition cursor-pointer flex items-center justify-center ${
            isMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={
            isMuted
              ? 'Unmute Microphone'
              : 'Mute Microphone'
          }
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* CAMERA */}
        <button
          onClick={
            handleToggleCamera
          }
          className={`p-3.5 rounded-2xl transition cursor-pointer flex items-center justify-center ${
            isCameraOff
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={
            isCameraOff
              ? 'Turn Camera On'
              : 'Turn Camera Off'
          }
        >
          {isCameraOff ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <Video className="w-5 h-5" />
          )}
        </button>

        {/* SCREEN SHARE */}
        <button
          onClick={
            handleToggleScreenShare
          }
          className={`p-3.5 rounded-2xl transition cursor-pointer flex items-center justify-center ${
            isScreenSharing
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title={
            isScreenSharing
              ? 'Stop Screen Share'
              : 'Share Screen'
          }
        >
          <ScreenShare className="w-5 h-5" />
        </button>

        {/* LEAVE */}
        <button
          onClick={
            handleLeaveCall
          }
          className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-2 shadow-lg ml-2"
          title="Leave Call"
        >
          <PhoneOff className="w-5 h-5" />

          <span>
            Leave Call
          </span>
        </button>
      </footer>
    </div>
  );
};

/*
 * LOCAL VIDEO TILE
 */
const LocalVideoTile: React.FC<{
  stream: MediaStream | null;
  currentUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  isCameraOff: boolean;
  isMuted: boolean;
  micVolume: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({
  stream,
  currentUser,
  isCameraOff,
  isMuted,
  micVolume,
  videoRef,
}) => {
  return (
    <div className="relative w-full h-full min-h-[260px] max-h-[700px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center">

      {!isCameraOff &&
      stream?.getVideoTracks()
        .length ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover transform -scale-x-100"
        />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <img
            src={
              currentUser.avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                currentUser.name
              )}`
            }
            alt={
              currentUser.name
            }
            className="w-20 h-20 rounded-full border-2 border-slate-700 bg-slate-800 object-cover"
          />

          <span className="mt-3 text-xs font-semibold text-slate-300">
            {currentUser.name}
          </span>

          <span className="text-[11px] text-slate-500 mt-1">
            Camera turned off
          </span>
        </div>
      )}

      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur border border-slate-700/60 text-xs font-medium text-white flex items-center gap-2">

        <span>
          {currentUser.name} (You)
        </span>

        {isMuted ? (
          <MicOff className="w-3.5 h-3.5 text-rose-400" />
        ) : (
          <div className="flex items-center gap-1">

            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

            <span className="text-[10px] text-emerald-400 font-mono">
              {micVolume > 5
                ? 'Mic: Talking'
                : 'Mic: On'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/*
 * REMOTE VIDEO TILE
 */
const RemoteVideoTile: React.FC<{
  participant: RemoteParticipant;
  compact?: boolean;
}> = ({
  participant,
  compact = false,
}) => {
  const videoRef =
    useRef<HTMLVideoElement>(null);

  const audioRef =
    useRef<HTMLAudioElement>(null);

  const [
    autoplayBlocked,
    setAutoplayBlocked,
  ] = useState(false);

  const [
    remoteVolume,
    setRemoteVolume,
  ] = useState(0);

  // ==========================================================
  // ATTACH REMOTE STREAM
  // ==========================================================

  useEffect(() => {
    const stream =
      participant.stream;

    if (!stream) {
      return;
    }

    console.log(
      '[RemoteVideoTile] Attaching remote stream:',
      {
        socketId:
          participant.socketId,

        videoTracks:
          stream.getVideoTracks()
            .map((track) => ({
              id: track.id,
              enabled:
                track.enabled,
              readyState:
                track.readyState,
            })),

        audioTracks:
          stream.getAudioTracks()
            .map((track) => ({
              id: track.id,
              enabled:
                track.enabled,
              readyState:
                track.readyState,
            })),
      }
    );

    // --------------------------------------------------------
    // VIDEO
    // --------------------------------------------------------

    if (videoRef.current) {
      videoRef.current.srcObject =
        stream;

      videoRef.current
        .play()
        .then(() => {
          console.log(
            '[RemoteVideoTile] Remote video playing'
          );
        })
        .catch((error) => {
          console.warn(
            '[RemoteVideoTile] Remote video autoplay failed:',
            error
          );
        });
    }

    // --------------------------------------------------------
    // AUDIO
    // --------------------------------------------------------

    if (audioRef.current) {
      audioRef.current.srcObject =
        stream;

      audioRef.current
        .play()
        .then(() => {
          setAutoplayBlocked(
            false
          );
        })
        .catch(() => {
          setAutoplayBlocked(
            true
          );
        });
    }
  }, [
    participant.stream,
    participant.socketId,
  ]);

  // ==========================================================
  // REMOTE AUDIO ACTIVITY
  // ==========================================================

  useEffect(() => {
    if (
      !participant.stream ||
      participant.isMuted
    ) {
      setRemoteVolume(0);
      return;
    }

    const audioTrack =
      participant.stream
        .getAudioTracks()[0];

    if (!audioTrack) {
      setRemoteVolume(0);
      return;
    }

    let audioCtx:
      | AudioContext
      | null = null;

    let analyser:
      | AnalyserNode
      | null = null;

    let source:
      | MediaStreamAudioSourceNode
      | null = null;

    let animId = 0;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as any)
          .webkitAudioContext;

      if (AudioCtxClass) {
        audioCtx =
          new AudioCtxClass();

        analyser =
          audioCtx.createAnalyser();

        analyser.fftSize = 64;

        const tempStream =
          new MediaStream([
            audioTrack,
          ]);

        source =
          audioCtx.createMediaStreamSource(
            tempStream
          );

        source.connect(
          analyser
        );

        const dataArray =
          new Uint8Array(
            analyser.frequencyBinCount
          );

        const loop = () => {
          if (!analyser) {
            return;
          }

          analyser.getByteFrequencyData(
            dataArray
          );

          let sum = 0;

          for (
            let i = 0;
            i < dataArray.length;
            i++
          ) {
            sum += dataArray[i];
          }

          const avg =
            dataArray.length > 0
              ? sum /
                dataArray.length
              : 0;

          setRemoteVolume(
            Math.min(
              100,
              Math.round(
                (avg / 128) *
                  100
              )
            )
          );

          animId =
            requestAnimationFrame(
              loop
            );
        };

        loop();
      }
    } catch (error) {
      console.warn(
        '[RemoteVideoTile] Audio visualizer error:',
        error
      );
    }

    return () => {
      if (animId) {
        cancelAnimationFrame(
          animId
        );
      }

      source?.disconnect();
      analyser?.disconnect();

      audioCtx
        ?.close()
        .catch(() => {});
    };
  }, [
    participant.stream,
    participant.isMuted,
  ]);

  // ==========================================================
  // MANUAL AUDIO
  // ==========================================================

  const handleManualUnmute =
    () => {
      if (!audioRef.current) {
        return;
      }

      audioRef.current
        .play()
        .then(() => {
          setAutoplayBlocked(
            false
          );
        })
        .catch((error) => {
          console.error(
            'Manual audio play failed:',
            error
          );
        });
    };

  // ==========================================================
  // ACTUAL VIDEO TRACK
  // ==========================================================

  const hasVideoTrack =
    participant.stream
      ?.getVideoTracks()
      .some(
        (track) =>
          track.readyState ===
          'live'
      ) ?? false;

  const showVideo =
    hasVideoTrack &&
    participant.isCameraOff !==
      true;

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div
      className={`relative w-full ${
        compact
          ? 'min-h-[220px] lg:h-[280px]'
          : 'h-full min-h-[260px] max-h-[700px]'
      } bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center`}
    >
      {/* ------------------------------------------------------
          REMOTE AUDIO
      ------------------------------------------------------ */}

      <audio
        ref={audioRef}
        autoPlay
        playsInline
      />

      {/* ------------------------------------------------------
          REMOTE VIDEO
      ------------------------------------------------------ */}

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          onLoadedMetadata={() => {
            videoRef.current
              ?.play()
              .catch(() => {});
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <img
            src={
              participant.user
                .avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                participant.user.name
              )}`
            }
            alt={
              participant.user.name
            }
            className="w-20 h-20 rounded-full border-2 border-slate-700 bg-slate-800 object-cover"
          />

          <span className="mt-3 text-xs font-semibold text-slate-300">
            {participant.user.name}
          </span>

          <span className="text-[11px] text-slate-500 mt-1">
            Camera turned off
          </span>
        </div>
      )}

      {/* ------------------------------------------------------
          AUDIO AUTOPLAY WARNING
      ------------------------------------------------------ */}

      {autoplayBlocked && (
        <div className="absolute inset-x-3 top-3 z-30 p-2.5 rounded-xl bg-amber-950/90 border border-amber-600 text-amber-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />

            <span>
              Remote audio is blocked
            </span>
          </div>

          <button
            onClick={
              handleManualUnmute
            }
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition cursor-pointer"
          >
            Enable Sound
          </button>
        </div>
      )}

      {/* ------------------------------------------------------
          PARTICIPANT LABEL
      ------------------------------------------------------ */}

      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur border border-slate-700/60 text-xs font-medium text-white flex items-center gap-2">
        <span>
          {participant.user.name}
        </span>

        {participant.isMuted ? (
          <MicOff className="w-3.5 h-3.5 text-rose-400" />
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              <span
                className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(
                    4,
                    (remoteVolume /
                      100) *
                      14
                  )}px`,
                }}
              />

              <span
                className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(
                    4,
                    (remoteVolume /
                      100) *
                      18
                  )}px`,
                }}
              />

              <span
                className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(
                    4,
                    (remoteVolume /
                      100) *
                      12
                  )}px`,
                }}
              />
            </div>

            {remoteVolume > 8 && (
              <span className="text-[10px] text-cyan-400 font-mono">
                Talking
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};