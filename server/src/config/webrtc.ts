export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRtcConfig {
  iceServers: IceServerConfig[];
  iceCandidatePoolSize: number;
}

export const defaultWebRtcConfig: WebRtcConfig = {
  iceServers: [
    // Standard Google STUN servers for NAT traversal across separate Wi-Fi / networks
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
        'stun:stun.cloudflare.com:3478',
        'stun:global.stun.twilio.com:3478',
      ],
    },
    // Optional TURN servers for symmetric NAT / strict enterprise firewalls
    ...(process.env.TURN_SERVER_URL
      ? [
          {
            urls: process.env.TURN_SERVER_URL.split(',').map(s => s.trim()),
            username: process.env.TURN_USERNAME || '',
            credential: process.env.TURN_PASSWORD || '',
          },
        ]
      : []),
  ],
  iceCandidatePoolSize: 10,
};
