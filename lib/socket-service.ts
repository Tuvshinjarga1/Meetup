import { io, Socket } from "socket.io-client";

export type CallData = {
  id: string;
  callerId: string;
  receiverId: string;
  type: "video" | "audio";
  status: string;
  timestamp: number;
  signalData?: any;
};

// Socket.IO хувьсагчийг global дотор тодорхойлох
declare global {
  interface Window {
    socketInstance?: Socket & { auth?: { userId?: string } };
  }
}

let socket: Socket | null = null;

export const initializeSocket = async (userId: string) => {
  if (socket) return;

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
    path: "/socket.io",
    query: { userId },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    auth: { userId },
  });

  // Глобал хувьсагчид socket-г оноох
  if (typeof window !== "undefined") {
    window.socketInstance = socket;
  }

  return new Promise<void>((resolve, reject) => {
    if (!socket) {
      reject(new Error("Socket initialization failed"));
      return;
    }

    socket.on("connect", () => {
      console.log("Socket connected");
      resolve();
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      reject(error);
    });
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;

    // Глобал хувьсагчаас socket-г устгах
    if (typeof window !== "undefined") {
      window.socketInstance = undefined;
    }
  }
};

export const startCall = async (
  callerId: string,
  receiverId: string,
  type: "video" | "audio"
): Promise<string> => {
  if (!socket) {
    throw new Error("Socket not initialized");
  }

  return new Promise((resolve, reject) => {
    socket?.emit(
      "call:initiate",
      {
        callerId,
        receiverId,
        type,
      },
      (response: { callId: string; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.callId);
        }
      }
    );
  });
};

export const subscribeToIncomingCalls = (
  callback: (call: CallData | null) => void
) => {
  if (!socket) {
    throw new Error("Socket not initialized");
  }

  const handler = (call: CallData) => {
    callback(call);
  };

  socket.on("call:incoming", handler);

  return () => {
    socket?.off("call:incoming", handler);
  };
};

export const subscribeToCall = (callback: (call: CallData | null) => void) => {
  if (!socket) {
    throw new Error("Socket not initialized");
  }

  const handler = (call: CallData) => {
    callback(call);
  };

  socket.on("call:update", handler);

  return () => {
    socket?.off("call:update", handler);
  };
};

// Function to send WebRTC signaling data
export const sendSignal = (to: string, signal: any, callId: string) => {
  if (!socket) {
    console.error("Socket not initialized for sending signal");
    return;
  }
  console.log(`Sending signal to ${to} for call ${callId}`);
  socket.emit("call:signal", { to, signal, callId });
};

// Function to subscribe to incoming WebRTC signaling data
export const subscribeToSignals = (
  callback: (data: { from: string; signal: any; callId: string }) => void
) => {
  if (!socket) {
    console.error("Socket not initialized for subscribing to signals");
    return () => {}; // Return an empty unsubscribe function
  }

  const handler = (data: { from: string; signal: any; callId: string }) => {
    console.log(`Received signal from ${data.from} for call ${data.callId}`);
    callback(data);
  };

  socket.on("call:signal", handler);

  // Return an unsubscribe function
  return () => {
    console.log("Unsubscribing from call:signal");
    socket?.off("call:signal", handler);
  };
};
