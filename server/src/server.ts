import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import app from "./app";

dotenv.config();

const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = http.createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Store users inside video-call rooms
const rooms = new Map<string, Set<string>>();

io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on("join-video-room", (roomId: string) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId)!;

    // Only allow two people for our first MVP
    if (room.size >= 2) {
      socket.emit("room-full");
      return;
    }

    room.add(socket.id);
    socket.join(roomId);

    console.log(
      `📹 ${socket.id} joined video room ${roomId}`
    );

    // Tell existing participant that another user joined
    socket.to(roomId).emit("peer-joined", {
      peerId: socket.id,
    });

    // Tell joining user how many people are currently present
    socket.emit("room-joined", {
      roomId,
      participants: room.size,
    });
  });

  // WebRTC Offer
  socket.on(
    "offer",
    ({ target, offer }) => {
      io.to(target).emit("offer", {
        offer,
        sender: socket.id,
      });
    }
  );

  // WebRTC Answer
  socket.on(
    "answer",
    ({ target, answer }) => {
      io.to(target).emit("answer", {
        answer,
        sender: socket.id,
      });
    }
  );

  // ICE Candidate
  socket.on(
    "ice-candidate",
    ({ target, candidate }) => {
      io.to(target).emit("ice-candidate", {
        candidate,
        sender: socket.id,
      });
    }
  );

  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);

    rooms.forEach((room, roomId) => {
      if (room.has(socket.id)) {
        room.delete(socket.id);

        socket.to(roomId).emit("peer-left");

        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `🚀 ConnectX server running on http://localhost:${PORT}`
  );
});