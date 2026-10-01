import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

function VideoCall() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("Not connected");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<Socket | null>(null);

  const peerConnectionRef =
    useRef<RTCPeerConnection | null>(null);

  const localStreamRef =
    useRef<MediaStream | null>(null);

  const screenStreamRef =
    useRef<MediaStream | null>(null);

  const remotePeerIdRef =
    useRef<string | null>(null);

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  useEffect(() => {
    if (status === "Connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((previous) => previous + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const createPeerConnection = (
    targetPeerId: string
  ) => {
    const peerConnection =
      new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      });

    peerConnectionRef.current =
      peerConnection;

    remotePeerIdRef.current =
      targetPeerId;

    const localStream =
      localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(
          track,
          localStream
        );
      });
    }

    peerConnection.ontrack = (event) => {
      const [remoteStream] =
        event.streams;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          remoteStream;
      }
    };

    peerConnection.onicecandidate =
      (event) => {
        if (
          event.candidate &&
          socketRef.current &&
          remotePeerIdRef.current
        ) {
          socketRef.current.emit(
            "ice-candidate",
            {
              target:
                remotePeerIdRef.current,
              candidate:
                event.candidate,
            }
          );
        }
      };

    return peerConnection;
  };

  const joinRoom = async () => {
    if (!roomId.trim()) {
      alert("Enter room ID");
      return;
    }

    try {
      setStatus(
        "Requesting camera and microphone..."
      );

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: true,
            audio: true,
          }
        );

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          stream;
      }

      const socket = io(SOCKET_URL);

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log(
          "Socket connected:",
          socket.id
        );

        socket.emit(
          "join-video-room",
          roomId
        );

        setJoined(true);
        setStatus(
          "Waiting for another participant..."
        );
      });

      socket.on("room-full", () => {
        setStatus(
          "Room is full. Only two participants are supported."
        );

        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      });

      socket.on(
        "peer-joined",
        async ({
          peerId,
        }: {
          peerId: string;
        }) => {
          setStatus("Connecting...");

          const peerConnection =
            createPeerConnection(
              peerId
            );

          const offer =
            await peerConnection.createOffer();

          await peerConnection.setLocalDescription(
            offer
          );

          socket.emit("offer", {
            target: peerId,
            offer,
          });
        }
      );

      socket.on(
        "offer",
        async ({
          offer,
          sender,
        }: {
          offer: RTCSessionDescriptionInit;
          sender: string;
        }) => {
          setStatus("Connecting...");

          const peerConnection =
            createPeerConnection(
              sender
            );

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );

          const answer =
            await peerConnection.createAnswer();

          await peerConnection.setLocalDescription(
            answer
          );

          socket.emit("answer", {
            target: sender,
            answer,
          });
        }
      );

      socket.on(
        "answer",
        async ({
          answer,
        }: {
          answer: RTCSessionDescriptionInit;
        }) => {
          if (
            peerConnectionRef.current
          ) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(
                answer
              )
            );

            setStatus("Connected");
          }
        }
      );

      socket.on(
        "ice-candidate",
        async ({
          candidate,
        }: {
          candidate: RTCIceCandidateInit;
        }) => {
          if (
            peerConnectionRef.current
          ) {
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(
                  candidate
                )
              );
            } catch (error) {
              console.error(
                "ICE candidate error:",
                error
              );
            }
          }
        }
      );

      socket.on("peer-left", () => {
        setStatus(
          "The other participant left the call."
        );

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject =
            null;
        }

        peerConnectionRef.current?.close();

        peerConnectionRef.current =
          null;
      });
    } catch (error) {
      console.error(
        "Camera/microphone error:",
        error
      );

      setStatus(
        "Camera or microphone permission denied."
      );
    }
  };

  const toggleMute = () => {
    const stream =
      localStreamRef.current;

    if (!stream) return;

    const audioTrack =
      stream.getAudioTracks()[0];

    if (!audioTrack) return;

    audioTrack.enabled =
      !audioTrack.enabled;

    setIsMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const stream =
      localStreamRef.current;

    if (!stream) return;

    const videoTrack =
      stream.getVideoTracks()[0];

    if (!videoTrack) return;

    videoTrack.enabled =
      !videoTrack.enabled;

    setIsCameraOff(
      !videoTrack.enabled
    );
  };

  const startScreenShare = async () => {
    if (!peerConnectionRef.current) {
      return;
    }

    try {
      const screenStream =
        await navigator.mediaDevices.getDisplayMedia(
          {
            video: true,
          }
        );

      screenStreamRef.current =
        screenStream;

      const screenTrack =
        screenStream.getVideoTracks()[0];

      const sender =
        peerConnectionRef.current
          .getSenders()
          .find(
            (sender) =>
              sender.track?.kind ===
              "video"
          );

      if (sender) {
        await sender.replaceTrack(
          screenTrack
        );
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          screenStream;
      }

      setIsScreenSharing(true);

      screenTrack.onended = async () => {
        await stopScreenShare();
      };
    } catch (error) {
      console.error(
        "Screen sharing error:",
        error
      );
    }
  };

  const stopScreenShare = async () => {
    const cameraStream =
      localStreamRef.current;

    if (!cameraStream) return;

    const cameraTrack =
      cameraStream.getVideoTracks()[0];

    const sender =
      peerConnectionRef.current
        ?.getSenders()
        .find(
          (sender) =>
            sender.track?.kind ===
            "video"
        );

    if (sender && cameraTrack) {
      await sender.replaceTrack(
        cameraTrack
      );
    }

    screenStreamRef.current
      ?.getTracks()
      .forEach((track) =>
        track.stop()
      );

    screenStreamRef.current =
      null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        cameraStream;
    }

    setIsScreenSharing(false);
  };

  const cleanupCall = () => {
    socketRef.current?.disconnect();

    localStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    screenStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    peerConnectionRef.current?.close();

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    socketRef.current = null;
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;

    setJoined(false);
    setCallDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
  };

  const leaveCall = () => {
    cleanupCall();
    setStatus("Call ended");
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">

      <div className="mx-auto max-w-6xl">

        <h1 className="mb-2 text-3xl font-bold text-cyan-400">
          ConnectX Video Call
        </h1>

        <p className="mb-6 text-slate-400">
          WebRTC-powered video communication
        </p>

        {!joined && (
          <div className="mb-8 flex max-w-xl gap-3">

            <input
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) =>
                setRoomId(e.target.value)
              }
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-500"
            />

            <button
              onClick={joinRoom}
              className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold hover:bg-cyan-600"
            >
              Join Call
            </button>

          </div>
        )}

        <div className="mb-6 flex items-center gap-4">

          <p className="text-sm text-slate-400">
            Status:{" "}
            <span className="text-cyan-400">
              {status}
            </span>
          </p>

          {status === "Connected" && (
            <p className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold">
              ⏱️ {formatDuration(callDuration)}
            </p>
          )}

        </div>

        <div className="grid gap-6 md:grid-cols-2">

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

            <div className="border-b border-slate-800 px-4 py-3">
              <p className="font-semibold">
                You
              </p>
            </div>

            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full bg-black object-cover"
            />

          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

            <div className="border-b border-slate-800 px-4 py-3">
              <p className="font-semibold">
                Other Participant
              </p>
            </div>

            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="aspect-video w-full bg-black object-cover"
            />

          </div>

        </div>

        {joined && (
          <div className="mt-6 flex flex-wrap gap-3">

            <button
              onClick={toggleMute}
              className={`rounded-lg px-6 py-3 font-semibold ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {isMuted
                ? "🔇 Unmute"
                : "🎤 Mute"}
            </button>

            <button
              onClick={toggleCamera}
              className={`rounded-lg px-6 py-3 font-semibold ${
                isCameraOff
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {isCameraOff
                ? "📹 Camera On"
                : "📹 Camera Off"}
            </button>

            {!isScreenSharing ? (
              <button
                onClick={startScreenShare}
                className="rounded-lg bg-slate-800 px-6 py-3 font-semibold hover:bg-slate-700"
              >
                🖥️ Share Screen
              </button>
            ) : (
              <button
                onClick={stopScreenShare}
                className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold hover:bg-cyan-600"
              >
                🛑 Stop Sharing
              </button>
            )}

            <button
              onClick={leaveCall}
              className="rounded-lg bg-red-500 px-8 py-3 font-semibold hover:bg-red-600"
            >
              📞 Leave Call
            </button>

          </div>
        )}

      </div>

    </div>
  );
}

export default VideoCall;