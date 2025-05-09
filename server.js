const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  onlineUsers.set(userId, socket.id);

  console.log(`User connected: ${userId}`);

  socket.on("call:initiate", (data, callback) => {
    const receiverSocketId = onlineUsers.get(data.receiverId);
    if (!receiverSocketId) {
      callback({ error: "User is offline" });
      return;
    }

    const callId = Date.now().toString();
    socket.to(receiverSocketId).emit("call:incoming", {
      id: callId,
      callerId: data.callerId,
      receiverId: data.receiverId,
      type: data.type,
      status: "pending",
      timestamp: Date.now(),
    });

    callback({ callId });
  });

  socket.on("call:accept", (data) => {
    const callerSocketId = onlineUsers.get(data.callerId);
    if (callerSocketId) {
      socket.to(callerSocketId).emit("call:update", {
        ...data,
        status: "accepted",
      });
    }
  });

  socket.on("call:reject", (data) => {
    const callerSocketId = onlineUsers.get(data.callerId);
    if (callerSocketId) {
      socket.to(callerSocketId).emit("call:update", {
        ...data,
        status: "rejected",
      });
    }
  });

  socket.on("call:end", (data) => {
    const otherSocketId = onlineUsers.get(
      data.callerId === userId ? data.receiverId : data.callerId
    );
    if (otherSocketId) {
      socket.to(otherSocketId).emit("call:update", {
        ...data,
        status: "ended",
      });
    }
  });

  // Handle WebRTC signaling
  socket.on("call:signal", (data) => {
    const receiverSocketId = onlineUsers.get(data.to);
    if (receiverSocketId) {
      console.log(
        `Relaying signal from ${userId} to ${data.to} for call ${data.callId}`
      );
      // Add sender's userId to the data before relaying
      socket.to(receiverSocketId).emit("call:signal", {
        from: userId, // Let the receiver know who sent the signal
        signal: data.signal,
        callId: data.callId,
      });
    } else {
      console.warn(`Signal recipient ${data.to} not found online.`);
      // Optionally inform the sender that the user is offline
      // socket.emit('call:signal_error', { callId: data.callId, error: 'User is offline' });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    console.log(`User disconnected: ${userId}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

// Clean up on server shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
  });
});
