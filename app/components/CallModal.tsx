"use client";

import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  CallData,
  acceptCall,
  endCall,
  rejectCall,
  updateSignalData,
} from "@/lib/call-service";
import { AlertCircle } from "lucide-react";

type CallModalProps = {
  call: CallData;
  isIncoming: boolean;
  onClose: () => void;
};

export default function CallModal({
  call,
  isIncoming,
  onClose,
}: CallModalProps) {
  const { user } = useAuth();
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Check WebRTC support
  useEffect(() => {
    // Check if browser supports WebRTC
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        "Таны хөтөч WebRTC дэмждэггүй байна. Chrome, Firefox эсвэл Safari хөтөч ашиглана уу."
      );
      return;
    }
  }, []);

  // Initialize peer connection
  useEffect(() => {
    if (!call || !user || error) return;

    // Request media permissions based on call type
    const getMedia = async () => {
      try {
        console.log("Requesting media access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: call.type === "video",
          audio: true,
        });

        console.log("Got media stream:", stream);
        localStreamRef.current = stream;

        // Display local video if it's a video call
        if (call.type === "video" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // Mute local video to prevent feedback
        }

        // Handle peer connection
        if (isIncoming) {
          // For incoming calls, wait until call is accepted
          if (call.status === "accepted") {
            initializePeer(false, stream);
          }
        } else {
          // For outgoing calls, initialize right away
          initializePeer(true, stream);
        }
      } catch (error: any) {
        console.error("Error accessing media devices:", error);
        let errorMessage = "Камер эсвэл микрофон ашиглах эрх алга байна.";

        if (error.name === "NotAllowedError") {
          errorMessage =
            "Камер/микрофон ашиглах зөвшөөрөл өгөөгүй байна. Хөтөчийн зөвшөөрлийг шалгана уу.";
        } else if (error.name === "NotFoundError") {
          errorMessage =
            "Камер эсвэл микрофон олдсонгүй. Төхөөрөмжөө шалгана уу.";
        } else if (error.name === "NotReadableError") {
          errorMessage =
            "Камер эсвэл микрофон ажиллахгүй байна. Өөр програм ашиглаж байгаа эсэхийг шалгана уу.";
        }

        setError(errorMessage);
        handleEndCall();
      }
    };

    if (call.status !== "ended" && call.status !== "rejected") {
      getMedia();
    }

    return () => {
      // Clean up on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log("Media track stopped:", track.kind);
        });
      }

      if (peerRef.current) {
        peerRef.current.destroy();
        console.log("Peer connection destroyed");
      }
    };
  }, [call, isIncoming, user, error]);

  // Handle call status changes
  useEffect(() => {
    if (!call || error) return;

    if (call.status === "ended" || call.status === "rejected") {
      setIsCallEnded(true);
      // Close modal after delay
      setTimeout(() => {
        handleCleanup();
      }, 2000);
    }

    // Handle signal data if present
    if (
      isIncoming &&
      call.status === "accepted" &&
      call.signalData &&
      peerRef.current
    ) {
      console.log("Received signal data:", call.signalData);
      peerRef.current.signal(call.signalData);
    }
  }, [call, isIncoming, error]);

  // Initialize WebRTC peer
  const initializePeer = (isInitiator: boolean, stream: MediaStream) => {
    console.log("Initializing peer connection, initiator:", isInitiator);

    // Use multiple STUN/TURN servers for better connectivity
    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      // Add public TURN server if possible (this is for example only)
      // {
      //   urls: 'turn:turn.example.com:3478',
      //   username: 'username',
      //   credential: 'password'
      // }
    ];

    try {
      const peer = new Peer({
        initiator: isInitiator,
        trickle: true, // Enable trickle ICE for better connectivity
        stream,
        config: { iceServers },
      });

      peer.on("signal", (data) => {
        console.log("Generated signal:", data);
        // Save signaling data to Firestore
        if (call.id) {
          updateSignalData(call.id, data);
        }
      });

      peer.on("connect", () => {
        console.log("Peer connection established!");
        setIsCallConnected(true);
      });

      peer.on("stream", (remoteStream) => {
        console.log("Received remote stream:", remoteStream);
        // Display remote video
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      peer.on("close", () => {
        console.log("Peer connection closed");
        handleCleanup();
      });

      peer.on("error", (err) => {
        console.error("Peer connection error:", err);
        setError("Холболтын алдаа гарлаа: " + err.message);
        handleCleanup();
      });

      // If we have signaling data already, use it
      if (call.signalData && !isInitiator) {
        console.log("Using existing signal data");
        peer.signal(call.signalData);
      }

      peerRef.current = peer;
    } catch (err) {
      console.error("Error creating peer:", err);
      setError("WebRTC холболт үүсгэхэд алдаа гарлаа.");
    }
  };

  // Handle accepting an incoming call
  const handleAcceptCall = async () => {
    if (!call.id) return;

    try {
      await acceptCall(call.id);
    } catch (error) {
      console.error("Error accepting call:", error);
      setError("Дуудлага хүлээн авахад алдаа гарлаа");
    }
  };

  // Handle rejecting an incoming call
  const handleRejectCall = async () => {
    if (!call.id) return;

    try {
      await rejectCall(call.id);
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  };

  // Handle ending an ongoing call
  const handleEndCall = async () => {
    if (!call.id) return;

    try {
      await endCall(call.id);
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  // Cleanup resources
  const handleCleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Media track stopped during cleanup:", track.kind);
      });
      localStreamRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      console.log("Peer connection destroyed during cleanup");
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        {/* Error Message */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md bg-red-100 p-3 text-red-800 dark:bg-red-900/20 dark:text-red-200">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Call Status Header */}
        <div className="mb-4 text-center">
          <h2 className="text-xl font-semibold">
            {isIncoming ? "Дуудлага ирж байна" : "Дуудлага хийж байна"}
          </h2>
          <p className="text-sm text-gray-500">
            {call.type === "video" ? "Видео дуудлага" : "Аудио дуудлага"}
          </p>
        </div>

        {/* Call UI */}
        {!error && (
          <div className="relative flex flex-col items-center">
            {/* Video container (for video calls) */}
            {call.type === "video" && (
              <div className="relative mb-4 h-60 w-full overflow-hidden rounded-lg bg-gray-900">
                {/* Remote video (main view) */}
                <video
                  ref={remoteVideoRef}
                  className="h-full w-full object-cover"
                  autoPlay
                  playsInline
                />

                {/* Local video (small overlay) */}
                <div className="absolute bottom-2 right-2 h-24 w-32 overflow-hidden rounded border-2 border-white">
                  <video
                    ref={localVideoRef}
                    className="h-full w-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                </div>
              </div>
            )}

            {/* Audio call UI */}
            {call.type === "audio" && (
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
                <svg
                  className="h-12 w-12 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
            )}

            {/* Call status text */}
            <p className="mb-4 text-center">
              {isCallEnded
                ? call.status === "rejected"
                  ? "Дуудлага татгалзсан"
                  : "Дуудлага дууссан"
                : isCallConnected
                ? "Холбогдсон"
                : isIncoming
                ? "Дуудлага ирж байна..."
                : "Дуудлага хийж байна..."}
            </p>

            {/* Call actions */}
            <div className="flex w-full justify-center gap-4">
              {/* Show accept/reject for incoming calls that are pending */}
              {isIncoming && call.status === "pending" && (
                <>
                  <Button
                    onClick={handleRejectCall}
                    variant="destructive"
                    className="rounded-full px-6"
                  >
                    Татгалзах
                  </Button>
                  <Button
                    onClick={handleAcceptCall}
                    variant="default"
                    className="rounded-full px-6"
                  >
                    Хүлээн авах
                  </Button>
                </>
              )}

              {/* Show end call button for connected calls or outgoing pending calls */}
              {(isCallConnected || !isIncoming) &&
                call.status !== "ended" &&
                call.status !== "rejected" && (
                  <Button
                    onClick={handleEndCall}
                    variant="destructive"
                    className="rounded-full px-6"
                  >
                    Дуудлага дуусгах
                  </Button>
                )}

              {/* Allow closing the modal for ended/rejected calls */}
              {(call.status === "ended" ||
                call.status === "rejected" ||
                error) && (
                <Button
                  onClick={handleCleanup}
                  variant="outline"
                  className="rounded-full px-6"
                >
                  Хаах
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
