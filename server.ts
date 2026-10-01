import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

import { authMiddleware } from './server/src/middleware/auth.js';
import * as authController from './server/src/controllers/authController.js';
import * as workspaceController from './server/src/controllers/workspaceController.js';
import * as messageController from './server/src/controllers/messageController.js';
import * as callController from './server/src/controllers/callController.js';
import { setupSocketSignaling } from './server/src/sockets/signaling.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  // Setup Socket.IO on the same HTTP server
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  setupSocketSignaling(io);

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', name: 'ConnectX API Gateway', timestamp: new Date().toISOString() });
  });

  // Auth Routes
  app.post('/api/auth/register', authController.register);
  app.post('/api/auth/login', authController.login);
  app.get('/api/auth/me', authMiddleware as any, authController.getMe as any);
  app.get('/api/users', authMiddleware as any, authController.getAllUsers as any);
  // Auth Routes
app.post(
  '/api/auth/register',
  authController.register
);

app.post(
  '/api/auth/login',
  authController.login
);

app.get(
  '/api/auth/me',
  authMiddleware as any,
  authController.getMe as any
);

app.get(
  '/api/users',
  authMiddleware as any,
  authController.getAllUsers as any
);

app.get(
  '/api/users/by-phone',
  authMiddleware as any,
  authController.findUserByPhone as any
);
  // Workspace Routes
  app.get('/api/workspaces', authMiddleware as any, workspaceController.getWorkspaces as any);
  app.post('/api/workspaces', authMiddleware as any, workspaceController.createWorkspace as any);
  app.post('/api/workspaces/join', authMiddleware as any, workspaceController.joinWorkspace as any);
  app.post('/api/workspaces/:workspaceId/channels', authMiddleware as any, workspaceController.addChannel as any);

  // Messaging Routes (Live & Offline Message support)
  app.get('/api/messages/channel/:channelId', authMiddleware as any, messageController.getChannelMessages as any);
  app.get('/api/messages/direct/:targetUserId', authMiddleware as any, messageController.getDirectMessages as any);
  app.get('/api/messages/unread', authMiddleware as any, messageController.getUnreadMessages as any);
  app.post('/api/messages', authMiddleware as any, messageController.postMessage as any);

  // WebRTC & Call Routes
  app.get('/api/calls/config', callController.getWebRtcConfig);
  app.post('/api/calls/log', authMiddleware as any, callController.logCall as any);
  app.get('/api/calls/history', callController.getCallHistory);

  // Vite middleware or static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data-store.json', '**/dist/**', '**/.git/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[ConnectX] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting ConnectX server:', err);
  process.exit(1);
});
