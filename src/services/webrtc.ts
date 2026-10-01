import { Socket } from 'socket.io-client';
import { api } from './api.js';

export interface RemoteParticipant {
  socketId: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  stream: MediaStream;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
}

export class WebRtcManager {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteParticipants: Map<string, RemoteParticipant> = new Map();

  private roomId = '';

  private currentUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };

  private isAudioOnly = false;
  private isMuted = false;

  private iceServers: RTCIceServer[] = [];
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  private listenersBound = false;

  public onParticipantsUpdate: (
    participants: RemoteParticipant[]
  ) => void = () => {};

  public onConnectionStateChange: (state: string) => void = () => {};

  public onScreenShareStateChange: (
    isSharing: boolean,
    stream: MediaStream | null
  ) => void = () => {};

  constructor(
    socket: Socket,
    currentUser: {
      id: string;
      name: string;
      avatarUrl?: string;
    }
  ) {
    this.socket = socket;
    this.currentUser = currentUser;
  }

  public async initialize(
    roomId: string,
    isAudioOnly: boolean = false
  ): Promise<MediaStream> {
    this.roomId = roomId;
    this.isAudioOnly = isAudioOnly;
    this.isMuted = false;

    try {
      const configRes = await api.getWebRtcConfig();
      this.iceServers = configRes.config.iceServers;
    } catch {
      this.iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ];
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isAudioOnly
          ? false
          : {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
            },
      });
    } catch (mediaErr) {
      console.warn(
        '[WebRTC] Advanced getUserMedia failed:',
        mediaErr
      );

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isAudioOnly ? false : true,
        });
      } catch (fallbackErr) {
        console.warn(
          '[WebRTC] Video failed. Falling back to audio:',
          fallbackErr
        );

        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        this.isAudioOnly = true;
      }
    }

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;

        console.log(
          `[WebRTC] Local audio track: ${track.label}`
        );
      });
    }

    this.setupSocketListeners();

    this.socket.emit('join-room', {
      roomId: this.roomId,
      user: this.currentUser,
    });

    return this.localStream;
  }

  private setupSocketListeners() {
    if (this.listenersBound) return;

    this.listenersBound = true;

    this.socket.on(
      'all-users-in-room',
      async (
        peers: {
          socketId: string;
          user: any;
        }[]
      ) => {
        console.log(
          '[WebRTC] Existing peers:',
          peers
        );

        for (const peer of peers) {
          if (this.peerConnections.has(peer.socketId)) {
            continue;
          }

          await this.createPeerConnection(
            peer.socketId,
            peer.user,
            true
          );
        }
      }
    );

    this.socket.on(
      'user-joined-room',
      (data: {
        socketId: string;
        user: any;
      }) => {
        console.log(
          '[WebRTC] Peer joined:',
          data.user.name
        );
      }
    );

    this.socket.on(
      'offer',
      async (payload: {
        sdp: RTCSessionDescriptionInit;
        callerSocketId: string;
        callerUser: any;
        isAudioOnly?: boolean;
      }) => {
        try {
          console.log(
            '[WebRTC] Received offer from:',
            payload.callerUser?.name
          );

          const pc = await this.createPeerConnection(
            payload.callerSocketId,
            payload.callerUser,
            false
          );

          await pc.setRemoteDescription(
            new RTCSessionDescription(payload.sdp)
          );

          await this.flushPendingCandidates(
            payload.callerSocketId,
            pc
          );

          const answer = await pc.createAnswer();

          await pc.setLocalDescription(answer);

          this.socket.emit('answer', {
            targetSocketId: payload.callerSocketId,
            answererSocketId: this.socket.id,
            sdp: answer,
          });
        } catch (error) {
          console.error(
            '[WebRTC] Failed to process offer:',
            error
          );
        }
      }
    );

    this.socket.on(
      'answer',
      async (payload: {
        sdp: RTCSessionDescriptionInit;
        answererSocketId: string;
      }) => {
        try {
          console.log(
            '[WebRTC] Received answer from:',
            payload.answererSocketId
          );

          const pc = this.peerConnections.get(
            payload.answererSocketId
          );

          if (!pc) return;

          await pc.setRemoteDescription(
            new RTCSessionDescription(payload.sdp)
          );

          await this.flushPendingCandidates(
            payload.answererSocketId,
            pc
          );
        } catch (error) {
          console.error(
            '[WebRTC] Failed to process answer:',
            error
          );
        }
      }
    );

    this.socket.on(
      'ice-candidate',
      async (payload: {
        candidate: RTCIceCandidateInit;
        fromSocketId: string;
      }) => {
        const pc = this.peerConnections.get(
          payload.fromSocketId
        );

        if (
          pc &&
          pc.remoteDescription &&
          pc.remoteDescription.type
        ) {
          try {
            await pc.addIceCandidate(
              new RTCIceCandidate(payload.candidate)
            );
          } catch (error) {
            console.warn(
              '[WebRTC] Failed to add ICE candidate:',
              error
            );
          }
        } else {
          if (
            !this.pendingCandidates.has(
              payload.fromSocketId
            )
          ) {
            this.pendingCandidates.set(
              payload.fromSocketId,
              []
            );
          }

          this.pendingCandidates
            .get(payload.fromSocketId)!
            .push(payload.candidate);
        }
      }
    );

    this.socket.on(
      'peer-media-toggle',
      (payload: any) => {
        const participant =
          this.remoteParticipants.get(
            payload.socketId
          );

        if (!participant) return;

        if (payload.isMuted !== undefined) {
          participant.isMuted = payload.isMuted;
        }

        if (payload.isCameraOff !== undefined) {
          participant.isCameraOff =
            payload.isCameraOff;
        }

        if (payload.isScreenSharing !== undefined) {
          participant.isScreenSharing =
            payload.isScreenSharing;
        }

        this.notifyParticipants();
      }
    );

    this.socket.on(
      'user-left-room',
      (data: {
        socketId: string;
        userId: string;
        name: string;
      }) => {
        console.log(
          '[WebRTC] Peer left:',
          data.name
        );

        this.closePeer(data.socketId);
      }
    );
  }

  private async flushPendingCandidates(
    socketId: string,
    pc: RTCPeerConnection
  ) {
    const queued =
      this.pendingCandidates.get(socketId) || [];

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (error) {
        console.warn(
          '[WebRTC] Failed to add queued ICE candidate:',
          error
        );
      }
    }

    this.pendingCandidates.delete(socketId);
  }

  private async createPeerConnection(
    targetSocketId: string,
    peerUser: any,
    isInitiator: boolean
  ): Promise<RTCPeerConnection> {
    const existing =
      this.peerConnections.get(targetSocketId);

    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    this.peerConnections.set(
      targetSocketId,
      pc
    );

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.enabled =
          track.kind === 'audio'
            ? !this.isMuted
            : true;

        pc.addTrack(
          track,
          this.localStream!
        );
      });
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      this.socket.emit('ice-candidate', {
        targetSocketId,
        candidate: event.candidate,
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `[WebRTC] ${targetSocketId} state:`,
        pc.connectionState
      );

      this.onConnectionStateChange(
        pc.connectionState
      );

      if (
        pc.connectionState === 'failed'
      ) {
        console.warn(
          '[WebRTC] Connection failed:',
          targetSocketId
        );
      }
    };

    pc.ontrack = (event) => {
      console.log(
        `[WebRTC] Received remote ${event.track.kind} track from ${targetSocketId}`
      );

      let participant =
        this.remoteParticipants.get(
          targetSocketId
        );

      if (!participant) {
        const stream = event.streams[0]
          ? new MediaStream(
              event.streams[0].getTracks()
            )
          : new MediaStream([
              event.track,
            ]);

        participant = {
          socketId: targetSocketId,
          user: peerUser,
          stream,
          isMuted: false,
          isCameraOff: false,
          isScreenSharing: false,
        };

        this.remoteParticipants.set(
          targetSocketId,
          participant
        );
      } else {
        if (event.streams[0]) {
          event.streams[0]
            .getTracks()
            .forEach((track) => {
              if (
                !participant!.stream
                  .getTracks()
                  .some(
                    (t) => t.id === track.id
                  )
              ) {
                participant!.stream.addTrack(
                  track
                );
              }
            });
        }

        if (
          !participant.stream
            .getTracks()
            .some(
              (track) =>
                track.id === event.track.id
            )
        ) {
          participant.stream.addTrack(
            event.track
          );
        }
      }

      this.notifyParticipants();
    };

    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(
        offer
      );

      this.socket.emit('offer', {
        targetSocketId,
        callerSocketId: this.socket.id,
        callerUser: this.currentUser,
        sdp: offer,
        isAudioOnly: this.isAudioOnly,
      });
    }

    return pc;
  }

  private notifyParticipants() {
    this.onParticipantsUpdate(
      Array.from(
        this.remoteParticipants.values()
      )
    );
  }

  private closePeer(socketId: string) {
    const pc =
      this.peerConnections.get(socketId);

    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();

      this.peerConnections.delete(
        socketId
      );
    }

    this.pendingCandidates.delete(
      socketId
    );

    this.remoteParticipants.delete(
      socketId
    );

    this.notifyParticipants();
  }

  public toggleMute(muted: boolean) {
    this.isMuted = muted;

    if (!this.localStream) return;

    this.localStream
      .getAudioTracks()
      .forEach((track) => {
        track.enabled = !muted;
      });

    this.socket.emit('media-toggle', {
      roomId: this.roomId,
      isMuted: muted,
    });
  }

  public toggleCamera(cameraOff: boolean) {
    if (!this.localStream) return;

    this.localStream
      .getVideoTracks()
      .forEach((track) => {
        track.enabled = !cameraOff;
      });

    this.socket.emit('media-toggle', {
      roomId: this.roomId,
      isCameraOff: cameraOff,
    });
  }

  public async startScreenShare(): Promise<MediaStream | null> {
    if (this.screenStream) {
      return this.screenStream;
    }

    try {
      const stream =
        await navigator.mediaDevices.getDisplayMedia(
          {
            video: true,
            audio: false,
          }
        );

      const screenTrack =
        stream.getVideoTracks()[0];

      if (!screenTrack) {
        stream.getTracks().forEach(
          (track) => track.stop()
        );

        return null;
      }

      this.screenStream = stream;

      this.peerConnections.forEach(
        (pc) => {
          const sender =
            pc
              .getSenders()
              .find(
                (s) =>
                  s.track?.kind ===
                  'video'
              );

          if (sender) {
            sender
              .replaceTrack(screenTrack)
              .catch((error) => {
                console.error(
                  '[WebRTC] Failed to replace video track:',
                  error
                );
              });
          }
        }
      );

      this.socket.emit('media-toggle', {
        roomId: this.roomId,
        isScreenSharing: true,
      });

      this.onScreenShareStateChange(
        true,
        stream
      );

      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return stream;
    } catch (error) {
      console.warn(
        '[WebRTC] Screen sharing canceled or denied:',
        error
      );

      this.screenStream = null;
      this.onScreenShareStateChange(
        false,
        null
      );

      return null;
    }
  }

  public stopScreenShare() {
    if (!this.screenStream) {
      return;
    }

    const stream = this.screenStream;

    const cameraTrack =
      this.localStream
        ?.getVideoTracks()[0] ||
      null;

    stream
      .getTracks()
      .forEach((track) => {
        track.onended = null;
        track.stop();
      });

    this.screenStream = null;

    this.peerConnections.forEach(
      (pc) => {
        const sender =
          pc
            .getSenders()
            .find(
              (s) =>
                s.track?.kind ===
                'video'
            );

        if (sender && cameraTrack) {
          sender
            .replaceTrack(cameraTrack)
            .catch((error) => {
              console.error(
                '[WebRTC] Failed to restore camera:',
                error
              );
            });
        }
      }
    );

    this.socket.emit('media-toggle', {
      roomId: this.roomId,
      isScreenSharing: false,
    });

    this.onScreenShareStateChange(
      false,
      null
    );
  }

  public leave() {
    if (this.screenStream) {
      this.screenStream
        .getTracks()
        .forEach((track) => {
          track.onended = null;
          track.stop();
        });

      this.screenStream = null;
    }

    if (this.localStream) {
      this.localStream
        .getTracks()
        .forEach((track) => track.stop());

      this.localStream = null;
    }

    this.peerConnections.forEach(
      (pc) => {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      }
    );

    this.peerConnections.clear();
    this.remoteParticipants.clear();
    this.pendingCandidates.clear();

    this.socket.emit(
      'leave-room',
      this.roomId
    );

    this.onScreenShareStateChange(
      false,
      null
    );

    this.notifyParticipants();
  }
}