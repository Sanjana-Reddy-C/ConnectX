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

type SocketHandler = (...args: any[]) => void;

export class WebRtcManager {
  private socket: Socket;

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private peerConnections =
    new Map<string, RTCPeerConnection>();

  private remoteParticipants =
    new Map<string, RemoteParticipant>();

  private pendingCandidates =
    new Map<string, RTCIceCandidateInit[]>();

  private roomId = '';

  private currentUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };

  private isAudioOnly = false;
  private isMuted = false;
  private isInitialized = false;
  private isLeaving = false;

  private iceServers: RTCIceServer[] = [];

  /*
   * Store every listener we attach to Socket.IO.
   *
   * This is important because when the call ends we need
   * to remove exactly these listeners.
   */
  private socketHandlers: Array<{
    event: string;
    handler: SocketHandler;
  }> = [];

  public onParticipantsUpdate: (
    participants: RemoteParticipant[]
  ) => void = () => {};

  public onConnectionStateChange: (
    state: string
  ) => void = () => {};

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

  // ============================================================
  // INITIALIZE
  // ============================================================

  public async initialize(
    roomId: string,
    isAudioOnly = false
  ): Promise<MediaStream> {
    /*
     * Prevent the same manager from being initialized twice.
     */
    if (this.isInitialized && this.localStream) {
      console.log(
        '[WebRTC] Already initialized. Reusing existing manager.'
      );

      return this.localStream;
    }

    if (this.isLeaving) {
      throw new Error(
        'WebRTC manager is shutting down.'
      );
    }

    this.roomId = roomId;
    this.isAudioOnly = isAudioOnly;
    this.isMuted = false;
    this.isInitialized = true;

    console.log(
      '[WebRTC] Initializing:',
      {
        roomId,
        isAudioOnly,
        user: this.currentUser.name,
      }
    );

    // ----------------------------------------------------------
    // ICE CONFIG
    // ----------------------------------------------------------

    try {
      const config =
        await api.getWebRtcConfig();

      this.iceServers =
        config.config.iceServers || [];

      console.log(
        '[WebRTC] ICE servers loaded:',
        this.iceServers
      );
    } catch (error) {
      console.warn(
        '[WebRTC] Failed to load ICE config. Using STUN fallback.',
        error
      );

      this.iceServers = [
        {
          urls:
            'stun:stun.l.google.com:19302',
        },
        {
          urls:
            'stun:stun1.l.google.com:19302',
        },
        {
          urls:
            'stun:stun.cloudflare.com:3478',
        },
      ];
    }

    // ----------------------------------------------------------
    // LOCAL MEDIA
    // ----------------------------------------------------------

    try {
      this.localStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },

          video: isAudioOnly
            ? false
            : {
                width: {
                  ideal: 1280,
                  max: 1920,
                },

                height: {
                  ideal: 720,
                  max: 1080,
                },

                frameRate: {
                  ideal: 30,
                  max: 30,
                },
              },
        });
    } catch (error) {
      console.warn(
        '[WebRTC] Preferred media request failed:',
        error
      );

      try {
        this.localStream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: !isAudioOnly,
          });
      } catch (fallbackError) {
        console.warn(
          '[WebRTC] Video unavailable. Falling back to audio:',
          fallbackError
        );

        this.localStream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });

        this.isAudioOnly = true;
      }
    }

    // ----------------------------------------------------------
    // ENABLE LOCAL TRACKS
    // ----------------------------------------------------------

    this.localStream
      .getAudioTracks()
      .forEach((track) => {
        track.enabled = true;

        console.log(
          '[WebRTC] Local audio:',
          track.label,
          track.readyState
        );
      });

    this.localStream
      .getVideoTracks()
      .forEach((track) => {
        track.enabled = true;

        console.log(
          '[WebRTC] Local video:',
          track.label,
          track.readyState
        );
      });

    // ----------------------------------------------------------
    // SOCKET LISTENERS
    // ----------------------------------------------------------

    this.setupSocketListeners();

    // ----------------------------------------------------------
    // JOIN ROOM
    // ----------------------------------------------------------

    this.socket.emit('join-room', {
      roomId: this.roomId,
      user: this.currentUser,
    });

    console.log(
      '[WebRTC] Joined room:',
      this.roomId
    );

    return this.localStream;
  }

  // ============================================================
  // SOCKET LISTENERS
  // ============================================================

  private addSocketListener(
    event: string,
    handler: SocketHandler
  ) {
    this.socket.on(event, handler);

    this.socketHandlers.push({
      event,
      handler,
    });
  }

  private setupSocketListeners() {
    /*
     * Never attach another set of listeners.
     */
    if (this.socketHandlers.length > 0) {
      return;
    }

    // ----------------------------------------------------------
    // EXISTING USERS
    // ----------------------------------------------------------

    this.addSocketListener(
      'all-users-in-room',
      async (
        peers: {
          socketId: string;
          user: any;
        }[]
      ) => {
        if (this.isLeaving) {
          return;
        }

        console.log(
          '[WebRTC] Existing peers:',
          peers
        );

        for (const peer of peers) {
          if (
            this.peerConnections.has(
              peer.socketId
            )
          ) {
            console.log(
              '[WebRTC] Peer already exists:',
              peer.socketId
            );

            continue;
          }

          try {
            await this.createPeerConnection(
              peer.socketId,
              peer.user,
              true
            );
          } catch (error) {
            console.error(
              '[WebRTC] Failed to create initiator peer:',
              error
            );
          }
        }
      }
    );

    // ----------------------------------------------------------
    // NEW USER
    // ----------------------------------------------------------

    this.addSocketListener(
      'user-joined-room',
      (data: {
        socketId: string;
        user: any;
      }) => {
        if (this.isLeaving) {
          return;
        }

        console.log(
          '[WebRTC] Peer joined:',
          data.user?.name
        );

        /*
         * We DO NOT create another connection here.
         *
         * The existing participant will already have
         * created the offer through all-users-in-room.
         */
      }
    );

    // ----------------------------------------------------------
    // OFFER
    // ----------------------------------------------------------

    this.addSocketListener(
      'offer',
      async (payload: {
        sdp: RTCSessionDescriptionInit;
        callerSocketId: string;
        callerUser: any;
        isAudioOnly?: boolean;
      }) => {
        if (this.isLeaving) {
          return;
        }

        try {
          console.log(
            '[WebRTC] Received offer from:',
            payload.callerUser?.name
          );

          let pc =
            this.peerConnections.get(
              payload.callerSocketId
            );

          /*
           * If we already have a peer connection:
           *
           * - stable = safe to accept a new offer
           * - have-local-offer = we already sent an offer,
           *   so ignore this duplicate offer
           * - other states = avoid signaling collision
           */
          if (pc) {
            console.log(
              '[WebRTC] Existing peer connection signaling state:',
              pc.signalingState
            );

            if (
              pc.signalingState ===
              'have-local-offer'
            ) {
              console.warn(
                '[WebRTC] Ignoring duplicate offer because we already sent an offer.'
              );

              return;
            }

            if (
              pc.signalingState !==
              'stable'
            ) {
              console.warn(
                '[WebRTC] Ignoring offer because signaling state is:',
                pc.signalingState
              );

              return;
            }
          } else {
            pc =
              await this.createPeerConnection(
                payload.callerSocketId,
                payload.callerUser,
                false
              );
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              payload.sdp
            )
          );

          await this.flushPendingCandidates(
            payload.callerSocketId,
            pc
          );

          const answer =
            await pc.createAnswer();

          await pc.setLocalDescription(
            answer
          );

          this.socket.emit(
            'answer',
            {
              targetSocketId:
                payload.callerSocketId,

              answererSocketId:
                this.socket.id,

              sdp: answer,
            }
          );

          console.log(
            '[WebRTC] Answer sent to:',
            payload.callerSocketId
          );
        } catch (error) {
          console.error(
            '[WebRTC] Failed to process offer:',
            error
          );
        }
      }
    );

    // ----------------------------------------------------------
    // ANSWER
    // ----------------------------------------------------------

    this.addSocketListener(
      'answer',
      async (payload: {
        sdp: RTCSessionDescriptionInit;
        answererSocketId: string;
      }) => {
        if (this.isLeaving) {
          return;
        }

        try {
          console.log(
            '[WebRTC] Received answer from:',
            payload.answererSocketId
          );

          const pc =
            this.peerConnections.get(
              payload.answererSocketId
            );

          if (!pc) {
            console.warn(
              '[WebRTC] No peer connection for answer:',
              payload.answererSocketId
            );

            return;
          }

          /*
           * A duplicate answer causes:
           *
           * InvalidStateError:
           * Called in wrong state: stable
           *
           * Only accept an answer while we are
           * waiting for the remote answer.
           */
          if (
            pc.signalingState !==
            'have-local-offer'
          ) {
            console.warn(
              '[WebRTC] Ignoring duplicate/late answer. Current state:',
              pc.signalingState
            );

            return;
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              payload.sdp
            )
          );

          await this.flushPendingCandidates(
            payload.answererSocketId,
            pc
          );

          console.log(
            '[WebRTC] Remote answer applied successfully.'
          );
        } catch (error) {
          console.error(
            '[WebRTC] Failed to process answer:',
            error
          );
        }
      }
    );

    // ----------------------------------------------------------
    // ICE CANDIDATE
    // ----------------------------------------------------------

    this.addSocketListener(
      'ice-candidate',
      async (payload: {
        candidate: RTCIceCandidateInit;
        fromSocketId: string;
      }) => {
        if (this.isLeaving) {
          return;
        }

        const pc =
          this.peerConnections.get(
            payload.fromSocketId
          );

        if (
          pc &&
          pc.remoteDescription
        ) {
          try {
            await pc.addIceCandidate(
              new RTCIceCandidate(
                payload.candidate
              )
            );
          } catch (error) {
            console.warn(
              '[WebRTC] Failed to add ICE candidate:',
              error
            );
          }

          return;
        }

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

        console.log(
          '[WebRTC] Queued ICE candidate for:',
          payload.fromSocketId
        );
      }
    );

    // ----------------------------------------------------------
    // MEDIA TOGGLE
    // ----------------------------------------------------------

    this.addSocketListener(
      'peer-media-toggle',
      (payload: any) => {
        if (this.isLeaving) {
          return;
        }

        const participant =
          this.remoteParticipants.get(
            payload.socketId
          );

        if (!participant) {
          return;
        }

        if (
          payload.isMuted !==
          undefined
        ) {
          participant.isMuted =
            payload.isMuted;
        }

        if (
          payload.isCameraOff !==
          undefined
        ) {
          participant.isCameraOff =
            payload.isCameraOff;
        }

        if (
          payload.isScreenSharing !==
          undefined
        ) {
          participant.isScreenSharing =
            payload.isScreenSharing;
        }

        this.notifyParticipants();
      }
    );

    // ----------------------------------------------------------
    // USER LEFT
    // ----------------------------------------------------------

    this.addSocketListener(
      'user-left-room',
      (data: {
        socketId: string;
        userId: string;
        name: string;
      }) => {
        if (this.isLeaving) {
          return;
        }

        console.log(
          '[WebRTC] Peer left:',
          data.name
        );

        this.closePeer(
          data.socketId
        );
      }
    );
  }

  // ============================================================
  // PENDING ICE
  // ============================================================

  private async flushPendingCandidates(
    socketId: string,
    pc: RTCPeerConnection
  ) {
    const queued =
      this.pendingCandidates.get(
        socketId
      ) || [];

    if (queued.length === 0) {
      return;
    }

    console.log(
      '[WebRTC] Flushing queued ICE candidates:',
      queued.length
    );

    for (
      const candidate of queued
    ) {
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate(
            candidate
          )
        );
      } catch (error) {
        console.warn(
          '[WebRTC] Failed to add queued ICE candidate:',
          error
        );
      }
    }

    this.pendingCandidates.delete(
      socketId
    );
  }

  // ============================================================
  // PEER CONNECTION
  // ============================================================

  private async createPeerConnection(
    targetSocketId: string,
    peerUser: any,
    isInitiator: boolean
  ): Promise<RTCPeerConnection> {
    /*
     * IMPORTANT:
     *
     * Never create two RTCPeerConnections
     * for the same participant.
     */
    const existing =
      this.peerConnections.get(
        targetSocketId
      );

    if (existing) {
      console.log(
        '[WebRTC] Reusing existing peer connection:',
        targetSocketId
      );

      return existing;
    }

    if (
      !this.localStream ||
      this.isLeaving
    ) {
      throw new Error(
        'Local stream is not ready.'
      );
    }

    console.log(
      '[WebRTC] Creating peer connection:',
      {
        targetSocketId,
        peer: peerUser?.name,
        isInitiator,
      }
    );

    const pc =
      new RTCPeerConnection({
        iceServers:
          this.iceServers,

        iceCandidatePoolSize: 10,
      });

    /*
     * Store immediately.
     *
     * This prevents another event from creating
     * another peer connection while this one
     * is being configured.
     */
    this.peerConnections.set(
      targetSocketId,
      pc
    );

    // ----------------------------------------------------------
    // ADD LOCAL TRACKS
    // ----------------------------------------------------------

    const tracks =
      this.localStream.getTracks();

    for (const track of tracks) {
      if (
        track.kind === 'audio'
      ) {
        track.enabled =
          !this.isMuted;
      } else {
        track.enabled = true;
      }

      pc.addTrack(
        track,
        this.localStream
      );

      console.log(
        `[WebRTC] Added local ${track.kind} track to peer`,
        {
          targetSocketId,
          trackId: track.id,
          enabled: track.enabled,
        }
      );
    }

    // ----------------------------------------------------------
    // ICE
    // ----------------------------------------------------------

    pc.onicecandidate =
      (event) => {
        if (
          !event.candidate ||
          this.isLeaving
        ) {
          return;
        }

        this.socket.emit(
          'ice-candidate',
          {
            targetSocketId,

            candidate:
              event.candidate,
          }
        );
      };

    // ----------------------------------------------------------
    // CONNECTION STATE
    // ----------------------------------------------------------

    pc.onconnectionstatechange =
      () => {
        console.log(
          `[WebRTC] ${targetSocketId} connection state:`,
          pc.connectionState
        );

        this.onConnectionStateChange(
          pc.connectionState
        );

        if (
          pc.connectionState ===
            'failed' ||
          pc.connectionState ===
            'closed'
        ) {
          console.warn(
            '[WebRTC] Peer connection ended:',
            targetSocketId
          );
        }
      };

    // ----------------------------------------------------------
    // ICE CONNECTION STATE
    // ----------------------------------------------------------

    pc.oniceconnectionstatechange =
      () => {
        console.log(
          `[WebRTC] ${targetSocketId} ICE state:`,
          pc.iceConnectionState
        );
      };

    // ----------------------------------------------------------
    // REMOTE TRACK
    // ----------------------------------------------------------

    pc.ontrack =
      (event) => {
        if (this.isLeaving) {
          return;
        }

        console.log(
          `[WebRTC] REMOTE ${event.track.kind} TRACK RECEIVED`,
          {
            from:
              targetSocketId,

            trackId:
              event.track.id,

            trackState:
              event.track.readyState,

            enabled:
              event.track.enabled,

            streams:
              event.streams.length,
          }
        );

        let participant =
          this.remoteParticipants.get(
            targetSocketId
          );

        // ------------------------------------------------------
        // FIRST REMOTE TRACK
        // ------------------------------------------------------

        if (!participant) {
          const remoteStream =
            new MediaStream();

          /*
           * Add all tracks supplied by the browser.
           */
          const incomingStream =
            event.streams[0];

          if (incomingStream) {
            incomingStream
              .getTracks()
              .forEach((track) => {
                if (
                  !remoteStream
                    .getTracks()
                    .some(
                      (existingTrack) =>
                        existingTrack.id ===
                        track.id
                    )
                ) {
                  remoteStream.addTrack(
                    track
                  );
                }
              });
          }

          /*
           * Make absolutely sure the current
           * track is present.
           */
          if (
            !remoteStream
              .getTracks()
              .some(
                (track) =>
                  track.id ===
                  event.track.id
              )
          ) {
            remoteStream.addTrack(
              event.track
            );
          }

          participant = {
            socketId:
              targetSocketId,

            user:
              peerUser,

            stream:
              remoteStream,

            isMuted: false,

            isCameraOff: false,

            isScreenSharing: false,
          };

          this.remoteParticipants.set(
            targetSocketId,
            participant
          );
        } else {
          // ----------------------------------------------------
          // ADDITIONAL REMOTE TRACK
          // ----------------------------------------------------

          const alreadyExists =
            participant.stream
              .getTracks()
              .some(
                (track) =>
                  track.id ===
                  event.track.id
              );

          if (!alreadyExists) {
            participant.stream.addTrack(
              event.track
            );
          }
        }

        // ------------------------------------------------------
        // TRACK STATE
        // ------------------------------------------------------

        const videoTracks =
          participant.stream
            .getVideoTracks();

        if (
          videoTracks.length > 0 &&
          participant.isCameraOff ===
            undefined
        ) {
          participant.isCameraOff =
            videoTracks.every(
              (track) =>
                !track.enabled
            );
        }

        console.log(
          '[WebRTC] Remote stream:',
          {
            socketId:
              targetSocketId,

            videoTracks:
              videoTracks.length,

            audioTracks:
              participant.stream
                .getAudioTracks()
                .length,
          }
        );

        this.notifyParticipants();
      };

    // ----------------------------------------------------------
    // INITIATOR
    // ----------------------------------------------------------

    if (
      isInitiator &&
      !this.isLeaving
    ) {
      /*
       * Make sure the connection is still
       * the one stored in our map.
       */
      if (
        this.peerConnections.get(
          targetSocketId
        ) !== pc
      ) {
        return pc;
      }

      const offer =
        await pc.createOffer();

      if (this.isLeaving) {
        return pc;
      }

      await pc.setLocalDescription(
        offer
      );

      /*
       * Only send the offer if this connection
       * is still the active connection.
       */
      if (
        this.peerConnections.get(
          targetSocketId
        ) === pc
      ) {
        this.socket.emit(
          'offer',
          {
            targetSocketId,

            callerSocketId:
              this.socket.id,

            callerUser:
              this.currentUser,

            sdp: offer,

            isAudioOnly:
              this.isAudioOnly,
          }
        );

        console.log(
          '[WebRTC] Offer sent to:',
          targetSocketId
        );
      }
    }

    return pc;
  }

  // ============================================================
  // PARTICIPANT UPDATE
  // ============================================================

  private notifyParticipants() {
    this.onParticipantsUpdate(
      Array.from(
        this.remoteParticipants.values()
      )
    );
  }

  // ============================================================
  // CLOSE ONE PEER
  // ============================================================

  private closePeer(
    socketId: string
  ) {
    const pc =
      this.peerConnections.get(
        socketId
      );

    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange =
        null;
      pc.oniceconnectionstatechange =
        null;

      try {
        pc.close();
      } catch {
        // Already closed.
      }

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

  // ============================================================
  // MUTE
  // ============================================================

  public toggleMute(
    muted: boolean
  ) {
    this.isMuted = muted;

    console.log(
      '[WebRTC] Microphone:',
      muted ? 'MUTED' : 'UNMUTED'
    );

    // ----------------------------------------------------------
    // LOCAL TRACK
    // ----------------------------------------------------------

    if (this.localStream) {
      this.localStream
        .getAudioTracks()
        .forEach((track) => {
          track.enabled =
            !muted;

          console.log(
            '[WebRTC] Audio track:',
            {
              id: track.id,
              enabled:
                track.enabled,
              readyState:
                track.readyState,
            }
          );
        });
    }

    // ----------------------------------------------------------
    // EVERY PEER CONNECTION
    // ----------------------------------------------------------

    this.peerConnections.forEach(
      (pc, socketId) => {
        pc.getSenders()
          .filter(
            (sender) =>
              sender.track?.kind ===
              'audio'
          )
          .forEach(
            (sender) => {
              if (sender.track) {
                sender.track.enabled =
                  !muted;
              }

              console.log(
                '[WebRTC] Audio sender updated:',
                {
                  socketId,
                  enabled:
                    sender.track
                      ?.enabled,
                }
              );
            }
          );
      }
    );

    // ----------------------------------------------------------
    // INFORM REMOTE USER
    // ----------------------------------------------------------

    if (
      this.roomId &&
      !this.isLeaving
    ) {
      this.socket.emit(
        'media-toggle',
        {
          roomId:
            this.roomId,

          isMuted:
            muted,
        }
      );
    }
  }

  // ============================================================
  // CAMERA
  // ============================================================

  public toggleCamera(
    cameraOff: boolean
  ) {
    if (!this.localStream) {
      return;
    }

    const videoTracks =
      this.localStream
        .getVideoTracks();

    videoTracks.forEach(
      (track) => {
        track.enabled =
          !cameraOff;

        console.log(
          '[WebRTC] Camera track:',
          {
            id: track.id,
            enabled:
              track.enabled,
            readyState:
              track.readyState,
          }
        );
      }
    );

    this.socket.emit(
      'media-toggle',
      {
        roomId:
          this.roomId,

        isCameraOff:
          cameraOff,
      }
    );
  }

  // ============================================================
  // SCREEN SHARE
  // ============================================================

  public async startScreenShare(): Promise<MediaStream | null> {
    if (this.screenStream) {
      return this.screenStream;
    }

    if (this.isLeaving) {
      return null;
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
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        return null;
      }

      this.screenStream =
        stream;

      // --------------------------------------------------------
      // REPLACE CAMERA TRACK
      // --------------------------------------------------------

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
              .replaceTrack(
                screenTrack
              )
              .catch((error) => {
                console.error(
                  '[WebRTC] Failed to replace video track:',
                  error
                );
              });
          }
        }
      );

      this.socket.emit(
        'media-toggle',
        {
          roomId:
            this.roomId,

          isScreenSharing:
            true,
        }
      );

      this.onScreenShareStateChange(
        true,
        stream
      );

      screenTrack.onended =
        () => {
          this.stopScreenShare();
        };

      console.log(
        '[WebRTC] Screen sharing started.'
      );

      return stream;
    } catch (error) {
      console.warn(
        '[WebRTC] Screen sharing canceled:',
        error
      );

      this.screenStream =
        null;

      this.onScreenShareStateChange(
        false,
        null
      );

      return null;
    }
  }

  // ============================================================
  // STOP SCREEN SHARE
  // ============================================================

  public stopScreenShare() {
    if (!this.screenStream) {
      return;
    }

    const stream =
      this.screenStream;

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

    this.screenStream =
      null;

    // ----------------------------------------------------------
    // RESTORE CAMERA
    // ----------------------------------------------------------

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

        if (
          sender &&
          cameraTrack
        ) {
          sender
            .replaceTrack(
              cameraTrack
            )
            .catch((error) => {
              console.error(
                '[WebRTC] Failed to restore camera:',
                error
              );
            });
        }
      }
    );

    /*
     * Restore the camera track's actual
     * enabled state.
     */
    if (cameraTrack) {
      cameraTrack.enabled =
        true;
    }

    this.socket.emit(
      'media-toggle',
      {
        roomId:
          this.roomId,

        isScreenSharing:
          false,
      }
    );

    this.onScreenShareStateChange(
      false,
      null
    );

    console.log(
      '[WebRTC] Screen sharing stopped.'
    );
  }

  // ============================================================
  // REMOVE SOCKET LISTENERS
  // ============================================================

  private removeSocketListeners() {
    for (
      const {
        event,
        handler,
      } of this.socketHandlers
    ) {
      this.socket.off(
        event,
        handler
      );
    }

    this.socketHandlers = [];

    console.log(
      '[WebRTC] Socket listeners removed.'
    );
  }

  // ============================================================
  // LEAVE
  // ============================================================

  public leave() {
    /*
     * Prevent leave from being executed
     * multiple times.
     */
    if (this.isLeaving) {
      return;
    }

    this.isLeaving = true;

    console.log(
      '[WebRTC] Leaving call...'
    );

    // ----------------------------------------------------------
    // SCREEN SHARE
    // ----------------------------------------------------------

    if (this.screenStream) {
      this.screenStream
        .getTracks()
        .forEach((track) => {
          track.onended = null;
          track.stop();
        });

      this.screenStream =
        null;
    }

    // ----------------------------------------------------------
    // LOCAL MEDIA
    // ----------------------------------------------------------

    if (this.localStream) {
      this.localStream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      this.localStream =
        null;
    }

    // ----------------------------------------------------------
    // PEER CONNECTIONS
    // ----------------------------------------------------------

    this.peerConnections.forEach(
      (pc) => {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange =
          null;
        pc.oniceconnectionstatechange =
          null;

        try {
          pc.close();
        } catch {
          // Already closed.
        }
      }
    );

    this.peerConnections.clear();

    // ----------------------------------------------------------
    // REMOTE DATA
    // ----------------------------------------------------------

    this.remoteParticipants.clear();

    this.pendingCandidates.clear();

    // ----------------------------------------------------------
    // SOCKET LISTENERS
    // ----------------------------------------------------------

    this.removeSocketListeners();

    // ----------------------------------------------------------
    // LEAVE ROOM
    // ----------------------------------------------------------

    if (this.roomId) {
      this.socket.emit(
        'leave-room',
        this.roomId
      );
    }

    // ----------------------------------------------------------
    // RESET
    // ----------------------------------------------------------

    this.roomId = '';
    this.isInitialized = false;

    this.onScreenShareStateChange(
      false,
      null
    );

    this.notifyParticipants();

    console.log(
      '[WebRTC] Call cleanup complete.'
    );
  }
}