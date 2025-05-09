import { NextApiRequest } from "next";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";

// Socket.IO сэрвэрийг API route гаднаас тохируулж байна
// API route дотор сэрвэр ажиллуулж болохгүй
let io: SocketIOServer | null = null;
let httpServer: any = null;

// Socket.IO серверийн холболт хэзээ эхэлсэн талаарх мэдээлэл
let isSocketServerInitialized = false;

// Next.js App Router handler
export async function GET(req: Request) {
  if (!isSocketServerInitialized) {
    isSocketServerInitialized = true;

    // Socket.IO server холболт эхлүүлэх кодыг Next.js app ачаалагдах үеийн
    // кодоос тусад нь тохируулах хэрэгтэй
    console.log(
      "Socket.IO server should be initialized outside of the API handler."
    );
  }

  return new Response(
    JSON.stringify({ status: "Socket.IO is configured separately" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

export async function POST(req: Request) {
  return GET(req);
}

// Socket.IO серверийг тусад нь process-д эхлүүлэх скрипт үүсгэх хэрэгтэй
// Жишээ нь: server.js файл үүсгээд дараах байдлаар ажиллуулах
/*
// Жишээ server.js файл:
const http = require('http');
const { Server } = require('socket.io');

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  onlineUsers.set(userId, socket.id);
  
  console.log(`User connected: ${userId}`);

  // Socket эвентүүд
  socket.on("call:initiate", (data, callback) => {
    // дуудлага эхлүүлэх
  });

  socket.on("call:accept", (data) => {
    // дуудлага хүлээн авах
  });

  socket.on("call:reject", (data) => {
    // дуудлага цуцлах
  });

  socket.on("call:end", (data) => {
    // дуудлага дуусгах
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    console.log(`User disconnected: ${userId}`);
  });
});

httpServer.listen(3001, () => {
  console.log('Socket.IO server running on port 3001');
});
*/
