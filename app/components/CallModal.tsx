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
import Image from "next/image";

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
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Initialize peer connection
  useEffect(() => {
    if (!call || !user) return;

    // Request media permissions based on call type
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: call.type === "video",
          audio: true,
        });

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
      } catch (error) {
        console.error("Error accessing media devices:", error);
        alert(
          "Could not access camera or microphone. Please check permissions."
        );
        handleEndCall();
      }
    };

    if (call.status !== "ended" && call.status !== "rejected") {
      getMedia();
    }

    return () => {
      // Clean up on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [call, isIncoming, user]);

  // Handle call status changes
  useEffect(() => {
    if (!call) return;

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
      peerRef.current.signal(call.signalData);
    }
  }, [call, isIncoming]);

  // Initialize WebRTC peer
  const initializePeer = (isInitiator: boolean, stream: MediaStream) => {
    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
      stream,
    });

    peer.on("signal", (data) => {
      // Save signaling data to Firestore
      if (call.id) {
        updateSignalData(call.id, data);
      }
    });

    peer.on("stream", (remoteStream) => {
      // Display remote video
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setIsCallConnected(true);
      }
    });

    peer.on("close", () => {
      handleCleanup();
    });

    peer.on("error", (err) => {
      console.error("Peer connection error:", err);
      handleCleanup();
    });

    // If we have signaling data already, use it
    if (call.signalData && !isInitiator) {
      peer.signal(call.signalData);
    }

    peerRef.current = peer;
  };

  // Handle accepting an incoming call
  const handleAcceptCall = async () => {
    if (!call.id) return;

    try {
      await acceptCall(call.id);
    } catch (error) {
      console.error("Error accepting call:", error);
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
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
        {/* Call Status Header */}
        <div className="mb-4 text-center">
          <h2 className="text-xl font-semibold">
            {isIncoming ? "Incoming Call" : "Outgoing Call"}
          </h2>
          <p className="text-sm text-gray-500">
            {call.type === "video" ? "Video Call" : "Audio Call"}
          </p>
        </div>

        {/* Call UI */}
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
              ? "Call ended"
              : isCallConnected
              ? "Connected"
              : isIncoming
              ? `Incoming ${call.type} call...`
              : `Calling...`}
          </p>

          {/* Call actions */}
          <div className="mt-4 flex justify-center space-x-4">
            {isIncoming && call.status === "pending" ? (
              <>
                {/* Accept call button */}
                <Button
                  onClick={handleAcceptCall}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 p-0 text-white hover:bg-green-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                </Button>

                {/* Reject call button */}
                <Button
                  onClick={handleRejectCall}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 p-0 text-white hover:bg-red-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </>
            ) : (
              !isCallEnded && (
                <Button
                  onClick={handleEndCall}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 p-0 text-white hover:bg-red-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
