"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneIcon, VideoIcon, XIcon } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import {
  subscribeToCall,
  CallData,
  sendSignal,
  subscribeToSignals,
} from "@/lib/socket-service";
import { io, Socket } from "socket.io-client";
import Peer, { Instance as PeerInstance, SignalData } from "simple-peer";

interface CallModalProps {
  call: CallData;
  isIncoming: boolean;
  onClose: () => void;
  localStream: MediaStream | null;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

// Socket.IO хувьсагчийг global өмнө нь тодорхойлсон бол ашиглах
declare global {
  interface Window {
    socketInstance?: Socket & { auth?: { userId?: string } };
  }
}

export default function CallModal({
  call,
  isIncoming,
  onClose,
  localStream,
  remoteVideoRef,
  localVideoRef,
}: CallModalProps) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);
  const socket = window.socketInstance;

  useEffect(() => {
    if (!socket || !localStream) return;

    // Initialize Peer
    const peer = new Peer({
      initiator: !isIncoming, // Caller initiates
      trickle: false, // Disable trickle ICE for simplicity
      stream: localStream,
    });

    peerRef.current = peer;

    // Caller: Send signal to receiver
    if (!isIncoming) {
      peer.on("signal", (signal) => {
        sendSignal(call.receiverId, signal, call.id);
      });
    }

    // Listener for signal from the other peer
    const unsubscribeSignals = subscribeToSignals((data) => {
      if (data.callId === call.id && peerRef.current && data.signal) {
        console.log("Received signal via subscription", data.signal);
        peerRef.current.signal(data.signal);
      } else {
        console.log("Ignored signal:", data);
      }
    });

    // Receiver: Send signal back to caller after receiving the initial signal
    if (isIncoming) {
      peer.on("signal", (signal) => {
        sendSignal(call.callerId, signal, call.id);
      });
    }

    // When remote stream is available
    peer.on("stream", (stream) => {
      console.log("Remote stream received");
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      // Optionally close the call on peer error
      // handleEndCall();
    });

    peer.on("close", () => {
      console.log("Peer connection closed");
      handleEndCall(false); // Don't emit end event if closed locally
    });

    // Handle incoming call updates (accepted, rejected, ended)
    const unsubscribeCallUpdates = subscribeToCall((updatedCall) => {
      if (!updatedCall || updatedCall.id !== call.id) return;
      console.log("Call update in modal:", updatedCall.status);
      if (updatedCall.status === "accepted") {
        // Potentially redundant if signal exchange starts immediately
        console.log("Call accepted by remote peer");
      } else if (
        updatedCall.status === "rejected" ||
        updatedCall.status === "ended"
      ) {
        console.log("Call rejected/ended by remote peer");
        handleEndCall(false); // Don't emit, just clean up
      }
    });

    // Cleanup
    return () => {
      console.log("Cleaning up CallModal peer and listeners");
      unsubscribeCallUpdates?.();
      unsubscribeSignals();
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      setRemoteStream(null);
    };
  }, [socket, localStream, isIncoming, call, remoteVideoRef]);

  // Set local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, localVideoRef]);

  const handleAction = (action: "accept" | "reject" | "end") => {
    if (!socket) {
      console.error("Socket not initialized");
      return;
    }

    const event = `call:${action}`;
    socket.emit(event, {
      id: call.id,
      callerId: call.callerId,
      receiverId: call.receiverId,
      type: call.type,
    });

    console.log(`Call action: ${action}`);
    if (action !== "accept") {
      handleEndCall(false); // Don't emit end again if rejecting/ending
    }
  };

  // Function to end call and clean up
  const handleEndCall = (emitEvent = true) => {
    console.log("Ending call, cleaning up...");
    if (emitEvent && socket) {
      socket.emit("call:end", {
        id: call.id,
        callerId: call.callerId,
        receiverId: call.receiverId,
      });
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setRemoteStream(null);
    onClose(); // Close the modal
  };

  return (
    <Dialog open={true} onOpenChange={() => handleEndCall()}>
      {" "}
      // End call if dialog is closed
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {call.type === "video" ? (
              <VideoIcon className="h-5 w-5" />
            ) : (
              <PhoneIcon className="h-5 w-5" />
            )}
            {isIncoming ? "Ирж буй дуудлага" : "Гарах дуудлага"}
            {call.status !== "pending" && ` (${call.status})`}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[300px]">
          {/* Local Video */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted // Mute local video to prevent echo
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              Та
            </div>
          </div>

          {/* Remote Video */}
          <div className="relative bg-muted rounded-lg overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                {call.status === "pending" && isIncoming
                  ? "Холбогдож байна..."
                  : call.status === "pending"
                  ? "Хүлээж байна..."
                  : "Холболт алга"}
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {call.callerId === window.socketInstance?.auth?.userId
                ? call.receiverId
                : call.callerId}
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-4">
          {isIncoming && call.status === "pending" ? (
            <>
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleAction("reject")}
                className="rounded-full w-12 h-12"
                title="Татгалзах"
              >
                <XIcon className="h-6 w-6" />
              </Button>
              <Button
                variant="default"
                size="icon"
                onClick={() => handleAction("accept")}
                className="rounded-full w-12 h-12 bg-green-500 hover:bg-green-600"
                title="Хүлээн авах"
              >
                <PhoneIcon className="h-6 w-6" />
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleEndCall()} // End call button
              className="rounded-full w-12 h-12"
              title="Дуусгах"
            >
              <XIcon className="h-6 w-6" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
