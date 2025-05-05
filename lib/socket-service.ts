import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export type CallData = {
  id?: string;
  callerId: string;
  receiverId: string;
  type: "audio" | "video";
  status: "pending" | "accepted" | "rejected" | "ended";
  timestamp: number;
  signalData?: any;
  peerConnection?: RTCPeerConnection;
};

// Socket холболт үүсгэх
export const initializeSocket = async (userId: string) => {
  if (socket) return socket;

  try {
    // Socket.io холболт
    await fetch("/api/socket");
    socket = io({
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    // Холболт үүссэн үед хэрэглэгчийг бүртгэх
    socket.on("connect", () => {
      console.log("Socket.io холболт амжилттай:", socket?.id);
      // Хэрэглэгчийг бүртгэх
      socket?.emit("register-user", userId);
    });

    // Алдаа гарсан үед
    socket.on("connect_error", (err) => {
      console.error("Socket холболтын алдаа:", err);
      socket = null;
    });

    // Холболт салсан үед
    socket.on("disconnect", (reason) => {
      console.log("Socket холболт салсан:", reason);
      if (reason === "io server disconnect") {
        // Сервер талаас холболт салгасан бол дахин холбогдох оролдлого хийх
        socket?.connect();
      }
    });

    return socket;
  } catch (error) {
    console.error("Socket холболт үүсгэхэд алдаа гарлаа:", error);
    return null;
  }
};

// Clean up socket connection
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("Socket холболт хаагдлаа");
  }
};

// Ensure socket exists or initialize it
const ensureSocket = async (userId: string) => {
  if (!socket) {
    return await initializeSocket(userId);
  }
  return socket;
};

// Дуудлага эхлүүлэх
export const startCall = async (
  callerId: string,
  receiverId: string,
  type: "audio" | "video",
  signalData?: any
): Promise<string> => {
  if (!socket) {
    throw new Error("Socket холболт байхгүй байна");
  }

  const callId = Date.now().toString();

  // WebRTC peer connection үүсгэх
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  // ICE candidate бэлэн болсон үед
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      updateSignalData(receiverId, {
        type: "candidate",
        candidate: event.candidate,
      });
    }
  };

  // Remote stream ирэх үед
  peerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById(
      "remote-video"
    ) as HTMLVideoElement;
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  socket.emit("call-user", {
    callerId,
    receiverId,
    type,
    signalData,
    peerConnection,
  });

  return callId;
};

// Дуудлага хүлээн авах
export const acceptCall = async (
  callerId: string,
  signalData: any
): Promise<void> => {
  if (!socket) {
    throw new Error("Socket холболт байхгүй байна");
  }

  // Хүлээн авагч дуудлагыг хүлээн авснаа дамжуулах
  socket.emit("accept-call", {
    callerId,
    signalData, // signalData null байж болно - signaling is done in subsequent exchanges
  });
};

// Дуудлага цуцлах
export const rejectCall = async (callerId: string): Promise<void> => {
  if (!socket) {
    throw new Error("Socket холболт байхгүй байна");
  }

  socket.emit("reject-call", { callerId });
};

// Дуудлага дуусгах
export const endCall = async (userId: string): Promise<void> => {
  if (!socket) {
    throw new Error("Socket холболт байхгүй байна");
  }

  socket.emit("end-call", { userId });
};

// Сигнал дата илгээх
export const updateSignalData = async (
  userId: string,
  signalData: any
): Promise<void> => {
  if (!socket) {
    console.warn("Socket холболт байхгүй байна сигнал датаг илгээхэд");

    try {
      // Try to initialize the socket if it doesn't exist
      const newSocket = await initializeSocket(userId);

      if (!newSocket) {
        throw new Error("Socket холболт үүсгэж чадсангүй");
      }

      // Now we have a socket, send the signal data
      newSocket.emit("signal-data", { userId, signalData });
    } catch (error) {
      console.error("Socket холболт үүсгэж чадсангүй:", error);
      throw error;
    }
  } else {
    // Socket already exists, send the signal data
    socket.emit("signal-data", { userId, signalData });
  }
};

// Дуудлага ирэхийг сонсох
export const subscribeToIncomingCalls = (
  callback: (call: CallData | null) => void
): (() => void) => {
  if (!socket) {
    console.warn(
      "Socket холболт байхгүй байна, дуудлага ирэхийг сонсох боломжгүй"
    );
    // Instead of returning empty function, return a function that warns if called
    return () =>
      console.warn(
        "Subscription doesn't exist because socket wasn't initialized"
      );
  }

  // Дуудлага ирэх үед
  socket.on("incoming-call", (data) => {
    const callData: CallData = {
      callerId: data.callerId,
      receiverId: "", // Хүлээн авагчийн ID өөрийнх байна
      type: data.type,
      status: "pending",
      timestamp: Date.now(),
      signalData: data.signalData,
    };

    callback(callData);
  });

  // Unsubscribe
  return () => {
    socket?.off("incoming-call");
  };
};

// Дуудлагын төлөв өөрчлөлтийг сонсох
export const subscribeToCall = (
  callback: (call: CallData | null) => void
): (() => void) => {
  if (!socket) {
    console.warn(
      "Socket холболт байхгүй байна, дуудлагын төлөв өөрчлөлтийг сонсох боломжгүй"
    );
    return () =>
      console.warn(
        "Subscription doesn't exist because socket wasn't initialized"
      );
  }

  // Дуудлага хүлээн авагдсан үед
  socket.on("call-accepted", (data) => {
    callback({
      status: "accepted",
      timestamp: Date.now(),
      callerId: "",
      receiverId: "",
      type: "audio", // энд хоосон утга буцаах боломжгүй
      signalData: data.signalData,
    });
  });

  // Дуудлага цуцлагдсан үед
  socket.on("call-rejected", () => {
    callback({
      status: "rejected",
      timestamp: Date.now(),
      callerId: "",
      receiverId: "",
      type: "audio",
    });
  });

  // Дуудлага дууссан үед
  socket.on("call-ended", () => {
    callback({
      status: "ended",
      timestamp: Date.now(),
      callerId: "",
      receiverId: "",
      type: "audio",
    });
  });

  // Signal дата ирэх үед
  socket.on("signal-data", (data) => {
    const currentCall = {
      status: "accepted" as const,
      timestamp: Date.now(),
      callerId: "",
      receiverId: "",
      type: "audio" as const,
      signalData: data.signalData,
    };

    callback(currentCall);
  });

  // Unsubscribe
  return () => {
    socket?.off("call-accepted");
    socket?.off("call-rejected");
    socket?.off("call-ended");
    socket?.off("signal-data");
  };
};
