import { Server } from "socket.io";

export default function SocketHandler(req, res) {
  if (res.socket.server.io) {
    console.log("Socket уже создан");
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000, // Longer ping timeout to avoid disconnections
  });

  res.socket.server.io = io;

  // Track connected users for debugging
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    console.log("Шинэ холболт:", socket.id);

    // Дуудлага эхлүүлэх
    socket.on("call-user", (data) => {
      try {
        const { callerId, receiverId, type, signalData } = data;
        console.log(`Socket: Дуудлага эхлүүлэх ${callerId} -> ${receiverId}`);

        // Check if receiver is in connected users
        if (connectedUsers.has(receiverId)) {
          console.log(`Receiver ${receiverId} is online, sending call request`);
        } else {
          console.log(`Receiver ${receiverId} is not connected, call may fail`);
        }

        io.to(receiverId).emit("incoming-call", {
          callerId,
          type,
          signalData,
        });
      } catch (error) {
        console.error("Socket error in call-user:", error);
      }
    });

    // Дуудлага хүлээн авах
    socket.on("accept-call", (data) => {
      try {
        const { callerId, signalData } = data;
        console.log(`Socket: Дуудлага хүлээн авах -> ${callerId}`);
        io.to(callerId).emit("call-accepted", { signalData });
      } catch (error) {
        console.error("Socket error in accept-call:", error);
      }
    });

    // Дуудлага цуцлах
    socket.on("reject-call", (data) => {
      try {
        const { callerId } = data;
        console.log(`Socket: Дуудлага цуцлах -> ${callerId}`);
        io.to(callerId).emit("call-rejected");
      } catch (error) {
        console.error("Socket error in reject-call:", error);
      }
    });

    // Дуудлага дуусгах
    socket.on("end-call", (data) => {
      try {
        const { userId } = data;
        console.log(`Socket: Дуудлага дуусгах -> ${userId}`);
        io.to(userId).emit("call-ended");
      } catch (error) {
        console.error("Socket error in end-call:", error);
      }
    });

    // WebRTC сигнал дамжуулах
    socket.on("signal-data", (data) => {
      try {
        const { userId, signalData } = data;
        console.log(`Socket: Сигнал дамжуулах -> ${userId}`, typeof signalData);

        // Add delay check to prevent signal data failing to route correctly
        if (connectedUsers.has(userId)) {
          // Direct send to the user socket
          const userSocketId = connectedUsers.get(userId);
          io.to(userSocketId).emit("signal-data", { signalData });

          // Also use room-based sending as a fallback
          io.to(userId).emit("signal-data", { signalData });
        } else {
          // Fallback to just room-based sending
          io.to(userId).emit("signal-data", { signalData });
          console.log(
            `Warning: User ${userId} not found in connected users map`
          );
        }
      } catch (error) {
        console.error("Socket error in signal-data:", error);
      }
    });

    // Хэрэглэгч холболт зогсоох
    socket.on("disconnect", () => {
      console.log("Хэрэглэгч холболт салгав:", socket.id);

      // Remove from connected users map
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`User ${userId} removed from connected users`);
          break;
        }
      }
    });

    // Хэрэглэгч өөрийн ID-г сақтах
    socket.on("register-user", (userId) => {
      if (!userId) {
        console.error("Register-user called with invalid userId");
        return;
      }

      // Store both socket room and direct mapping
      socket.join(userId);
      connectedUsers.set(userId, socket.id);

      console.log("Хэрэглэгч бүртгэгдэв:", userId, "Socket ID:", socket.id);
      console.log("Connected users:", Array.from(connectedUsers.keys()));
    });

    // Handle socket errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  console.log("Socket.IO сервер эхэллээ");
  res.end();
}
