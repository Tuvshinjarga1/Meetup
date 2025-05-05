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
} from "@/lib/socket-service";
import { AlertCircle, XIcon, PhoneIcon, VideoIcon } from "lucide-react";

interface CallModalProps {
  call: CallData;
  isIncoming: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function CallModal({
  call,
  isIncoming,
  onClose,
  children,
}: CallModalProps) {
  const { user } = useAuth();
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [peerIsInitialized, setPeerIsInitialized] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

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

    console.log(
      "Call effect triggered, call status:",
      call.status,
      "isIncoming:",
      isIncoming
    );

    // Request media permissions based on call type
    const getMedia = async () => {
      try {
        console.log("Requesting media access...");

        // Use more specific constraints for better audio quality
        const constraints = {
          video:
            call.type === "video"
              ? {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  frameRate: { ideal: 30 },
                }
              : false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        console.log("Got media stream:", stream);
        // Check if audio tracks exist and are enabled
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          console.log("Audio tracks found:", audioTracks.length);
          audioTracks.forEach((track) => {
            console.log(
              `Audio track: ${track.label}, enabled: ${track.enabled}`
            );
            // Force enable audio track
            track.enabled = true;
          });
        } else {
          console.warn("No audio tracks found in stream!");
          // Try to add audio if missing (some browsers separate video/audio)
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            audioStream.getAudioTracks().forEach((track) => {
              stream.addTrack(track);
              console.log("Added missing audio track:", track.label);
            });
          } catch (err) {
            console.error("Could not add audio track:", err);
          }
        }

        localStreamRef.current = stream;

        // Display local video if it's a video call
        if (call.type === "video" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // Mute local video to prevent feedback

          // Add play handler to verify video is showing
          localVideoRef.current.onloadedmetadata = () => {
            console.log("Local video metadata loaded, playing...");
            localVideoRef.current
              ?.play()
              .then(() => console.log("Local video playing"))
              .catch((err) => console.error("Error playing local video:", err));
          };
        }

        // Clearly define when to initialize the peer
        if (isIncoming) {
          // For incoming calls, we only initialize the peer when accepted
          if (call.status === "accepted") {
            console.log(
              "Incoming call is accepted, initializing peer connection"
            );
            initializePeer(false, stream);
            // Also ensure UI update
            if (!isCallConnected) {
              console.log(
                "Setting call as connected on incoming accepted call"
              );
              setIsCallConnected(true);
            }
          }
        } else {
          // For outgoing calls, initialize as the caller
          console.log("Outgoing call, initializing as caller");
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

    // Force UI update if call is already accepted
    if (call.status === "accepted" && !isCallConnected) {
      console.log("Call is already accepted but UI not updated, updating now");
      setIsCallConnected(true);
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
  }, [call, isIncoming, user, error, isCallConnected]);

  // Handle call status changes
  useEffect(() => {
    if (!call || error) return;

    console.log("Call status changed:", call.status);

    if (call.status === "ended" || call.status === "rejected") {
      setIsCallEnded(true);
      // Close modal after delay
      setTimeout(() => {
        handleCleanup();
      }, 2000);
    }

    // Set call as connected when it's accepted to show proper UI immediately
    if (call.status === "accepted") {
      console.log("Call is accepted, updating UI...");
      // Don't wait for the peer connection to complete to update the UI
      // This makes sure the user sees something happening immediately
      setTimeout(() => {
        if (!isCallConnected) {
          console.log("Setting UI to connected state");
          setIsCallConnected(true);
        }
      }, 500);
    }

    // Handle incoming signal data from the other peer
    if (call.signalData && peerRef.current) {
      try {
        // Check if peer is still valid before signaling
        if (peerIsInitialized) {
          console.log("Processing signal data:", call.signalData);
          peerRef.current.signal(call.signalData);
        } else {
          console.warn("Received signal data but peer is not initialized");
        }
      } catch (err) {
        console.error("Error processing signal data:", err);
      }
    }

    // Handle accepted call for incoming calls - initialize peer
    if (
      isIncoming &&
      call.status === "accepted" &&
      localStreamRef.current &&
      !peerIsInitialized
    ) {
      console.log("Call accepted, initializing peer");
      initializePeer(false, localStreamRef.current);
    }
  }, [call, error, peerIsInitialized, isIncoming, isCallConnected]);

  // Peer connection events
  useEffect(() => {
    // If peer is initialized, make sure we handle connection events properly
    const currentPeer = peerRef.current;

    if (currentPeer && peerIsInitialized) {
      // Listen for connect event to update UI state
      console.log("Setting up additional connect handler for UI update");

      // Direct handler for connection established
      const connectHandler = () => {
        console.log(
          "🎉 Peer connection established successfully! (from additional handler)"
        );
        setIsCallConnected(true);
      };

      // Add our extra handler
      currentPeer.on("connect", connectHandler);

      // Additional cleanup for this effect
      return () => {
        // Try to remove our handler to prevent memory leaks
        if (currentPeer) {
          try {
            // @ts-ignore - TypeScript doesn't know about removeListener
            if (typeof currentPeer.removeListener === "function") {
              // @ts-ignore
              currentPeer.removeListener("connect", connectHandler);
            }
          } catch (err) {
            console.error("Error removing event listener:", err);
          }
        }
      };
    }
  }, [peerIsInitialized]);

  // Initialize WebRTC peer
  const initializePeer = (isInitiator: boolean, stream: MediaStream) => {
    if (peerIsInitialized && peerRef.current) {
      console.log("Peer already initialized, not creating another one");
      return;
    }

    console.log("Initializing peer connection, initiator:", isInitiator);

    try {
      // Mark as initializing first to prevent race conditions
      setPeerIsInitialized(true);

      // Use multiple STUN/TURN servers for better connectivity
      const iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        // Add Google's public TURN server (requires registration in production)
        {
          urls: "turn:global.turn.twilio.com:3478?transport=udp",
          username:
            "f4b4035eaa76f9c0c46f2275ff98534311dd69a006d667ca114c334f8e6fa2ce",
          credential: "h+IV7kVIHHJJn4If7vUCiUNS9yQK8IgKN1/kdEb8KWQ=",
        },
      ];

      const peer = new Peer({
        initiator: isInitiator,
        trickle: true, // Enable trickle ICE for better connectivity
        stream,
        config: { iceServers },
        sdpTransform: (sdp) => {
          // This helps prevent some issues with SDP negotiation
          console.log("Transforming SDP");
          // Force to add audio codecs if they're missing
          if (!sdp.includes("opus/48000")) {
            console.log("Adding opus codec to SDP");
            // This adds the opus codec if it's missing
            sdp = sdp.replace(
              /(m=audio \d+ UDP\/TLS\/RTP\/SAVPF)(?!.*opus)/,
              "$1 111"
            );
            sdp += "a=rtpmap:111 opus/48000/2\r\n";
            sdp += "a=fmtp:111 minptime=10;useinbandfec=1\r\n";
          }
          return sdp;
        },
      });

      console.log("Peer object created, setting up event handlers");

      // We successfully created the peer
      peerRef.current = peer;

      // Set up all event handlers immediately
      peer.on("signal", (data) => {
        // Verify peer is still valid and matches our current reference
        if (peer !== peerRef.current || !peerIsInitialized) {
          console.warn("Signal generated but peer is no longer valid");
          return;
        }

        console.log("Generated signal:", typeof data, data);
        // Send signaling data via Socket.io
        if (isIncoming) {
          // If incoming call, send signal to caller
          updateSignalData(call.callerId, data);
        } else {
          // If outgoing call, send signal to receiver
          updateSignalData(call.receiverId, data);
        }
      });

      // Main connection handler
      peer.on("connect", () => {
        console.log("🎉 Peer connection established successfully!");
        setIsCallConnected(true);
      });

      peer.on("stream", (remoteStream) => {
        console.log("🎥 Received remote stream:", remoteStream);
        // Display remote video
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          // Make sure audio is unmuted
          remoteVideoRef.current.muted = false;
          // Force autoplay (sometimes browsers block it)
          remoteVideoRef.current.play().catch((err) => {
            console.error("Error auto-playing remote stream:", err);
          });
        } else {
          console.error("No remote video ref found to attach stream!");
        }
      });

      // Log ICE connection state changes
      peer.on("iceStateChange", (state) => {
        console.log("ICE state changed to:", state);
        // If we lose connection, try to reconnect
        if (state === "disconnected" || state === "failed") {
          console.warn("ICE connection failed, may not be able to communicate");
        }
      });

      peer.on("close", () => {
        console.log("Peer connection closed");
        setPeerIsInitialized(false);
        handleCleanup();
      });

      peer.on("error", (err) => {
        console.error("Peer connection error:", err);
        setError("Холболтын алдаа гарлаа: " + err.message);
        setPeerIsInitialized(false);
        handleCleanup();
      });

      // Log tracks received
      peer.on("track", (track, stream) => {
        console.log("Received track:", track.kind, "in stream:", stream.id);
      });

      // If we have signaling data already and we are the receiver, use it
      if (call.signalData && !isInitiator) {
        console.log("Using existing signal data in initialization");
        const signalDataToUse = call.signalData;

        // Only apply signal data if it's still the same peer
        // Use a ref to the current peer that won't be affected by React rerenders
        const currentPeer = peer;

        // Apply the signal data after a brief delay to ensure the peer is ready
        setTimeout(() => {
          try {
            // Double check the peer is still the same instance and hasn't been destroyed
            if (peerRef.current === currentPeer && peerIsInitialized) {
              console.log("Applying saved signal data");
              currentPeer.signal(signalDataToUse);
            } else {
              console.warn(
                "Not applying signal: peer has been destroyed or changed"
              );
            }
          } catch (err) {
            console.error("Error applying initial signal:", err);
          }
        }, 500); // Small delay to ensure peer is ready
      }
    } catch (err) {
      console.error("Error creating peer:", err);
      setError("WebRTC холболт үүсгэхэд алдаа гарлаа.");
      setPeerIsInitialized(false);
    }
  };

  // Ensure audio/video are working properly
  const ensureMediaIsPlaying = () => {
    // Check local media
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const localStream = localVideoRef.current.srcObject as MediaStream;
      console.log(
        "Local media tracks:",
        localStream
          .getTracks()
          .map((t) => `${t.kind}: ${t.enabled ? "enabled" : "disabled"}`)
          .join(", ")
      );
    }

    // Check remote media
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      const remoteStream = remoteVideoRef.current.srcObject as MediaStream;
      console.log(
        "Remote media tracks:",
        remoteStream
          .getTracks()
          .map((t) => `${t.kind}: ${t.enabled ? "enabled" : "disabled"}`)
          .join(", ")
      );

      // If remote video is playing but no sound, try to fix it
      if (isCallConnected && remoteStream.getAudioTracks().length > 0) {
        const audioTracks = remoteStream.getAudioTracks();
        console.log("Remote audio tracks:", audioTracks.length);

        // Force enable all audio tracks
        audioTracks.forEach((track) => {
          track.enabled = true;
          console.log(`Enabled audio track: ${track.id}`);
        });

        // Ensure video element is playing and unmuted
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;

        // Try to play the audio directly to work around browser restrictions
        try {
          // Create an AudioContext to force audio processing
          // @ts-ignore - TypeScript may not recognize window.AudioContext
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(remoteStream);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);

          console.log("Created audio processing chain to force audio playback");

          // Try setting audio output device if available
          if (
            remoteVideoRef.current.setSinkId &&
            typeof remoteVideoRef.current.setSinkId === "function"
          ) {
            try {
              // Try to use default audio output device
              // @ts-ignore - TypeScript may not recognize setSinkId
              remoteVideoRef.current
                .setSinkId("")
                .then(() => console.log("Audio output set to default speaker"))
                .catch((err) =>
                  console.error("Error setting audio output:", err)
                );
            } catch (err) {
              console.error("setSinkId error:", err);
            }
          }

          // Also try playing manually
          remoteVideoRef.current
            .play()
            .then(() => console.log("Remote video playing successfully"))
            .catch((err) =>
              console.error("Could not play remote stream:", err)
            );
        } catch (err) {
          console.error("Audio processing error:", err);
        }
      } else if (
        isCallConnected &&
        remoteStream.getAudioTracks().length === 0
      ) {
        console.warn("No audio tracks in remote stream! Audio won't work.");
      }
    } else if (isCallConnected) {
      console.warn("Remote video element has no stream attached!");
    }
  };

  // Call the audio check when connection is established
  useEffect(() => {
    if (isCallConnected) {
      console.log("Call connected, checking streams...");

      // Check if we have local audio tracks
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        console.log(
          `Local audio tracks: ${audioTracks.length}`,
          audioTracks.map((t) => ({
            enabled: t.enabled,
            muted: t.muted,
            label: t.label,
          }))
        );

        if (audioTracks.length > 0) {
          // Start monitoring local audio levels
          const cleanupLocalAudio = monitorAudioLevels(localStreamRef.current);

          // Still check media regularly to ensure playback
          const checkInterval = setInterval(ensureMediaIsPlaying, 3000);

          return () => {
            if (cleanupLocalAudio) cleanupLocalAudio();
            clearInterval(checkInterval);
          };
        }
      }

      // Also check remote audio if available
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        const remoteStream = remoteVideoRef.current.srcObject as MediaStream;
        const remoteAudioTracks = remoteStream.getAudioTracks();

        console.log(
          `Remote audio tracks: ${remoteAudioTracks.length}`,
          remoteAudioTracks.map((t) => ({
            enabled: t.enabled,
            muted: t.muted,
            label: t.label,
          }))
        );

        // Monitor remote audio levels instead of local if available
        if (remoteAudioTracks.length > 0) {
          const cleanupRemoteAudio = monitorAudioLevels(remoteStream);

          // Still check media regularly to ensure playback
          const checkInterval = setInterval(ensureMediaIsPlaying, 3000);

          return () => {
            if (cleanupRemoteAudio) cleanupRemoteAudio();
            clearInterval(checkInterval);
          };
        }
      }

      // If we don't have any audio to monitor, still ensure media is playing
      console.log(
        "No audio tracks found to monitor, ensuring media is playing"
      );
      setTimeout(ensureMediaIsPlaying, 1000);
      const checkInterval = setInterval(ensureMediaIsPlaying, 3000);
      return () => clearInterval(checkInterval);
    }
  }, [isCallConnected]);

  // Function to monitor audio levels for debugging
  const monitorAudioLevels = (stream: MediaStream) => {
    try {
      // @ts-ignore - TypeScript may not recognize window.AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn("AudioContext not available");
        return;
      }

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Don't connect to destination to avoid feedback

      // Check levels periodically
      const checkLevel = () => {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);

        // Calculate average volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        if (avg > 0) {
          console.log(`Audio level detected: ${avg.toFixed(2)}`);
          // Update audio level state for UI feedback
          setAudioLevel(avg);
        } else {
          setAudioLevel(0);
        }
      };

      // Check levels every 100ms for smoother animation
      const interval = setInterval(checkLevel, 100);

      // Return cleanup function
      return () => {
        clearInterval(interval);
        audioContext.close();
      };
    } catch (err) {
      console.error("Error monitoring audio levels:", err);
      return () => {}; // Return empty cleanup
    }
  };

  // Handle accepting an incoming call
  const handleAcceptCall = async () => {
    if (!call.callerId) return;

    try {
      console.log("Accepting call from:", call.callerId);

      // Show accepting UI immediately without waiting for server response
      console.log("Call accepted locally, updating UI state immediately");
      setIsCallConnected(true);

      // Accept call first, the initializePeer will be called when status updates
      await acceptCall(call.callerId, null);

      // Initialize peer here as well to ensure it happens immediately
      if (localStreamRef.current && !peerIsInitialized) {
        console.log("Initializing peer on accept");
        initializePeer(false, localStreamRef.current);
      }

      // Force audio permission if not requested yet
      if (!localStreamRef.current?.getAudioTracks().length) {
        try {
          console.log("Requesting audio permissions explicitly");
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          console.log(
            "Got audio stream with",
            audioStream.getAudioTracks().length,
            "audio tracks"
          );

          if (localStreamRef.current) {
            // Add audio tracks to existing stream
            audioStream.getAudioTracks().forEach((track) => {
              localStreamRef.current?.addTrack(track);
            });
          } else {
            // Set as new stream
            localStreamRef.current = audioStream;
          }
        } catch (err) {
          console.error("Error getting audio permissions:", err);
        }
      }
    } catch (error) {
      console.error("Error accepting call:", error);
      setError("Дуудлага хүлээн авахад алдаа гарлаа");
      setIsCallConnected(false); // Reset if there was an error
    }
  };

  // Handle rejecting an incoming call
  const handleRejectCall = async () => {
    if (!call.callerId) return;

    try {
      await rejectCall(call.callerId);
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  };

  // Handle ending an ongoing call
  const handleEndCall = async () => {
    // Send to both parties to ensure call ends properly
    try {
      if (isIncoming) {
        await endCall(call.callerId);
      } else {
        await endCall(call.receiverId);
      }
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  // Cleanup resources - make sure to cancel any ongoing operations
  const handleCleanup = () => {
    console.log("Running cleanup...");

    // Mark as not initialized first to prevent any new signal attempts
    setPeerIsInitialized(false);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Media track stopped during cleanup:", track.kind);
      });
      localStreamRef.current = null;
    }

    if (peerRef.current) {
      try {
        peerRef.current.destroy();
        console.log("Peer connection destroyed during cleanup");
      } catch (err) {
        console.error("Error destroying peer:", err);
      }
      peerRef.current = null;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {call.type === "video" ? "Видео дуудлага" : "Аудио дуудлага"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {children}

        <div className="flex justify-center gap-4 mt-4">
          {isIncoming ? (
            <>
              <Button
                variant="destructive"
                size="lg"
                onClick={handleRejectCall}
                className="rounded-full"
              >
                <XIcon className="h-6 w-6" />
              </Button>
              <Button
                variant="default"
                size="lg"
                onClick={handleAcceptCall}
                className="rounded-full bg-green-500 hover:bg-green-600"
              >
                <PhoneIcon className="h-6 w-6" />
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              size="lg"
              onClick={handleEndCall}
              className="rounded-full"
            >
              <XIcon className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Call Timer Component to show duration of connected call
function CallTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prevSeconds) => prevSeconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="text-lg font-mono font-semibold">{formatTime(seconds)}</div>
  );
}
