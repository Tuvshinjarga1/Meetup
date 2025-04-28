"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarIcon,
  MapPinIcon,
  MessageCircleIcon,
  VideoIcon,
  MicIcon,
  MicOffIcon,
  VideoOffIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { EventChat } from "@/components/event-chat";
import { useAuth } from "@/contexts/auth-context";
import {
  getEvent,
  updateRSVP,
  getEventAttendees,
  type EventData,
} from "@/lib/event-service";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { use } from "react";
import { getImageFromStorage } from "@/lib/image-service";

// Define peer signal message type
type PeerSignal = {
  id?: string;
  eventId: string;
  senderId: string;
  receiverId: string | null; // null if broadcast to all peers
  type: "offer" | "answer" | "ice-candidate" | "join" | "leave";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp: number;
};

type PageParams = {
  id: string;
};

export default function EventPage(props: { params: Promise<PageParams> }) {
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [organizer, setOrganizer] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<
    "going" | "maybe" | "not-going" | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Video conference state
  const [joinedMeeting, setJoinedMeeting] = useState(false);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activeParticipants, setActiveParticipants] = useState<string[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const peerConnections = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const remoteStreams = useRef<{ [peerId: string]: MediaStream }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalCleanupRef = useRef<(() => void) | null>(null);

  // React.use() ашиглаж params-ийг задлах
  const params = use(props.params);
  const eventId = params.id;

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        if (eventId === "create") {
          router.push("/events/create");
          return;
        }

        const eventData = await getEvent(eventId);
        setEvent(eventData);

        // Check if meeting is active
        if (eventData.meetingActive) {
          setIsMeetingActive(true);
        }

        // Get organizer data
        const organizerDoc = await getDoc(
          doc(db, "users", eventData.createdBy)
        );
        if (organizerDoc.exists()) {
          setOrganizer({
            id: eventData.createdBy,
            ...organizerDoc.data(),
          });
        }

        // Get attendees
        const attendeesList = await getEventAttendees(eventId);
        setAttendees(attendeesList);

        // Check user's RSVP status
        if (user && eventData.attendees && eventData.attendees[user.uid]) {
          setRsvpStatus(eventData.attendees[user.uid].status);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching event:", error);
        setError("Эвент олдсонгүй. Эвент устгагдсан эсвэл буруу ID байна.");
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, user, router]);

  const handleRSVP = async (status: "going" | "maybe" | "not-going") => {
    if (!user || !event) return;

    try {
      await updateRSVP(eventId, user.uid, status);
      setRsvpStatus(status);

      // Update local state
      setEvent((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          attendees: {
            ...prev.attendees,
            [user.uid]: {
              status,
              timestamp: new Date().toISOString(),
            },
          },
        };
      });
    } catch (error) {
      console.error("Error updating RSVP:", error);
    }
  };

  // Start or join meeting
  const handleStartMeeting = async () => {
    if (!user || !event) return;

    try {
      // If organizer is starting the meeting
      if (user.uid === event.createdBy && !isMeetingActive) {
        // Update event in Firestore to indicate meeting is active
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, {
          meetingActive: true,
        });
        setIsMeetingActive(true);
      }

      // Join the meeting
      await joinMeeting();
    } catch (error) {
      console.error("Error starting meeting:", error);
    }
  };

  // Send signal to Firebase
  const sendSignal = async (signal: Omit<PeerSignal, "timestamp">) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "peerSignals"), {
        ...signal,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error sending signal:", error);
    }
  };

  // Handle ICE candidates
  const handleICECandidate =
    (peerId: string) => (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && user) {
        sendSignal({
          eventId,
          senderId: user.uid,
          receiverId: peerId,
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
        });
      }
    };

  // Create peer connection
  const createPeerConnection = (peerId: string) => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          peerConnection.addTrack(track, localStreamRef.current);
        }
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = handleICECandidate(peerId);

    // Handle receiving remote tracks
    peerConnection.ontrack = (event) => {
      if (!remoteStreams.current[peerId]) {
        remoteStreams.current[peerId] = new MediaStream();
        addRemoteVideo(peerId);
      }

      event.streams[0].getTracks().forEach((track) => {
        if (remoteStreams.current[peerId]) {
          remoteStreams.current[peerId].addTrack(track);
        }
      });
    };

    peerConnections.current[peerId] = peerConnection;
    return peerConnection;
  };

  // Add remote video to the grid
  const addRemoteVideo = (peerId: string) => {
    // Don't add if we already have this peer's video
    const existingVideo = document.getElementById(`remote-video-${peerId}`);
    if (existingVideo) return;

    const attendee = attendees.find((a) => a.id === peerId);
    const displayName = attendee?.displayName || "Хэрэглэгч";

    // Create video element
    const videoContainer = document.createElement("div");
    videoContainer.className =
      "relative aspect-video bg-gray-800 rounded-lg overflow-hidden";
    videoContainer.id = `remote-container-${peerId}`;

    const videoElement = document.createElement("video");
    videoElement.id = `remote-video-${peerId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.className = "w-full h-full object-cover";
    videoElement.srcObject = remoteStreams.current[peerId];

    const nameLabel = document.createElement("div");
    nameLabel.className =
      "absolute bottom-2 left-2 text-white text-sm bg-black/60 px-2 py-1 rounded";
    nameLabel.textContent = displayName;

    videoContainer.appendChild(videoElement);
    videoContainer.appendChild(nameLabel);

    if (remoteVideosRef.current) {
      remoteVideosRef.current.appendChild(videoContainer);
    }

    // Add to active participants
    setActiveParticipants((prev) => [...prev, peerId]);
  };

  // Remove remote video from the grid
  const removeRemoteVideo = (peerId: string) => {
    const videoContainer = document.getElementById(
      `remote-container-${peerId}`
    );
    if (videoContainer && remoteVideosRef.current) {
      remoteVideosRef.current.removeChild(videoContainer);
    }

    // Remove from active participants
    setActiveParticipants((prev) => prev.filter((id) => id !== peerId));
  };

  // Create offer to start peer connection
  const createOffer = async (peerId: string) => {
    if (!user) return;

    try {
      const peerConnection = createPeerConnection(peerId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      sendSignal({
        eventId,
        senderId: user.uid,
        receiverId: peerId,
        type: "offer",
        sdp: offer,
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  // Handle received offer by creating answer
  const handleOffer = async (signal: PeerSignal) => {
    if (!user || !localStreamRef.current) return;

    try {
      const peerConnection = createPeerConnection(signal.senderId);
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(signal.sdp!)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      sendSignal({
        eventId,
        senderId: user.uid,
        receiverId: signal.senderId,
        type: "answer",
        sdp: answer,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  // Handle received answer
  const handleAnswer = async (signal: PeerSignal) => {
    if (peerConnections.current[signal.senderId] && signal.sdp) {
      try {
        await peerConnections.current[signal.senderId].setRemoteDescription(
          new RTCSessionDescription(signal.sdp)
        );
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (signal: PeerSignal) => {
    if (peerConnections.current[signal.senderId] && signal.candidate) {
      try {
        await peerConnections.current[signal.senderId].addIceCandidate(
          new RTCIceCandidate(signal.candidate)
        );
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    }
  };

  // Handle peer join
  const handlePeerJoin = async (signal: PeerSignal) => {
    if (!user || user.uid === signal.senderId) return;

    // Create offer to the new peer
    await createOffer(signal.senderId);
  };

  // Handle peer leave
  const handlePeerLeave = (signal: PeerSignal) => {
    // Close peer connection
    if (peerConnections.current[signal.senderId]) {
      peerConnections.current[signal.senderId].close();
      delete peerConnections.current[signal.senderId];
    }

    // Remove remote stream
    if (remoteStreams.current[signal.senderId]) {
      delete remoteStreams.current[signal.senderId];
    }

    // Remove remote video
    removeRemoteVideo(signal.senderId);
  };

  // Subscribe to signaling channel
  const subscribeToSignals = () => {
    if (!user || !eventId) return () => {};

    const signalQuery = query(
      collection(db, "peerSignals"),
      where("eventId", "==", eventId)
    );

    const unsubscribe = onSnapshot(signalQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const signal = {
            id: change.doc.id,
            ...change.doc.data(),
          } as PeerSignal;

          // Only process recent signals (within the last minute)
          const isRecent = Date.now() - signal.timestamp < 60000;

          // Skip signals sent by this user
          if (signal.senderId === user.uid) return;

          // Skip signals not intended for this user
          if (signal.receiverId && signal.receiverId !== user.uid) return;

          if (isRecent) {
            switch (signal.type) {
              case "join":
                handlePeerJoin(signal);
                break;
              case "offer":
                handleOffer(signal);
                break;
              case "answer":
                handleAnswer(signal);
                break;
              case "ice-candidate":
                handleIceCandidate(signal);
                break;
              case "leave":
                handlePeerLeave(signal);
                break;
            }
          }

          // Clean up old signals
          if (!isRecent) {
            deleteDoc(doc(db, "peerSignals", signal.id!)).catch((error) => {
              console.error("Error deleting old signal:", error);
            });
          }
        }
      });
    });

    return unsubscribe;
  };

  // Join existing meeting
  const joinMeeting = async () => {
    if (!user) return;

    try {
      // Request permissions for audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setJoinedMeeting(true);

      // Announce joining to all peers
      await sendSignal({
        eventId,
        senderId: user.uid,
        receiverId: null, // broadcast to all
        type: "join",
      });

      // Listen for signal messages
      const unsubscribe = subscribeToSignals();
      signalCleanupRef.current = unsubscribe;

      // Add active participants
      setActiveParticipants((prev) => [...prev, user.uid]);
    } catch (error) {
      console.error("Error accessing media devices:", error);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  // Leave meeting
  const leaveMeeting = async () => {
    if (!user) return;

    // Announce leaving to all peers
    await sendSignal({
      eventId,
      senderId: user.uid,
      receiverId: null, // broadcast to all
      type: "leave",
    });

    // Stop listening for signals
    if (signalCleanupRef.current) {
      signalCleanupRef.current();
      signalCleanupRef.current = null;
    }

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    Object.values(peerConnections.current).forEach((connection) => {
      connection.close();
    });
    peerConnections.current = {};
    remoteStreams.current = {};

    // Clear remote videos
    if (remoteVideosRef.current) {
      remoteVideosRef.current.innerHTML = "";
    }

    setJoinedMeeting(false);
    setActiveParticipants([]);

    // If organizer is leaving and no one else is in the meeting, end it
    if (
      user &&
      event &&
      user.uid === event.createdBy &&
      activeParticipants.length <= 1
    ) {
      try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, {
          meetingActive: false,
        });
        setIsMeetingActive(false);
      } catch (error) {
        console.error("Error updating meeting status:", error);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close all peer connections
      Object.values(peerConnections.current).forEach((connection) => {
        connection.close();
      });

      // Stop listening for signals
      if (signalCleanupRef.current) {
        signalCleanupRef.current();
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">Ачааллаж байна...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <h2 className="text-2xl font-bold mb-4">Эвент олдсонгүй</h2>
            <p className="text-muted-foreground mb-6">
              {error || "Эвент устгагдсан эсвэл буруу ID байна."}
            </p>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => router.back()}>
                Буцах
              </Button>
              <Link href="/events">
                <Button>Бүх эвентүүд харах</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="mb-6">
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-6">
                <img
                  src={
                    event.imageUrl ||
                    `/placeholder.svg?height=400&width=800&text=Эвент`
                  }
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{event.eventType}</Badge>
                {event.isOnline && <Badge className="bg-primary">Онлайн</Badge>}
              </div>

              <h1 className="text-3xl font-bold mb-4">{event.title}</h1>

              <div className="flex items-center gap-2 mb-6">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={organizer?.photoURL || undefined}
                    alt={organizer?.displayName || "Organizer"}
                  />
                  <AvatarFallback>
                    {organizer?.displayName?.charAt(0) || "O"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">
                  Зохион байгуулагч: {organizer?.displayName || "Хэрэглэгч"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <CalendarIcon className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Огноо, цаг</p>
                    <p className="font-medium">
                      {event.date}, {event.time}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MapPinIcon className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Байршил</p>
                    <p className="font-medium">{event.location}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-bold">Тайлбар</h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {event.description}
                </p>
              </div>
            </div>

            <Tabs defaultValue="chat" className="mt-8">
              <TabsList className="mb-4">
                <TabsTrigger value="chat">
                  <MessageCircleIcon className="h-4 w-4 mr-2" />
                  Чат
                </TabsTrigger>
                {event.isOnline && (
                  <TabsTrigger value="video">
                    <VideoIcon className="h-4 w-4 mr-2" />
                    Видео уулзалт
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="chat" className="space-y-4">
                <EventChat eventId={eventId} />
              </TabsContent>

              {event.isOnline && (
                <TabsContent value="video" className="space-y-4">
                  {joinedMeeting ? (
                    <div className="border rounded-lg p-4 h-[500px] bg-gray-900 relative">
                      <div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-[400px] overflow-y-auto"
                        ref={remoteVideosRef}
                      >
                        {/* Local video */}
                        <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-2 left-2 text-white text-sm bg-black/60 px-2 py-1 rounded">
                            Та ({user?.displayName || "Хэрэглэгч"})
                          </div>
                        </div>

                        {/* Remote videos are dynamically added here */}
                      </div>

                      {/* Participants count */}
                      <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-white text-sm">
                        Оролцогч: {activeParticipants.length}
                      </div>

                      {/* Video controls */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800/80 px-6 py-3 rounded-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full bg-white/10 hover:bg-white/20"
                          onClick={toggleAudio}
                        >
                          {audioEnabled ? (
                            <MicIcon className="h-5 w-5 text-white" />
                          ) : (
                            <MicOffIcon className="h-5 w-5 text-red-500" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full bg-white/10 hover:bg-white/20"
                          onClick={toggleVideo}
                        >
                          {videoEnabled ? (
                            <VideoIcon className="h-5 w-5 text-white" />
                          ) : (
                            <VideoOffIcon className="h-5 w-5 text-red-500" />
                          )}
                        </Button>

                        <Button
                          variant="destructive"
                          className="rounded-full"
                          onClick={leaveMeeting}
                        >
                          Гарах
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 h-[400px] flex items-center justify-center bg-gray-50">
                      <div className="text-center">
                        <VideoIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">
                          {isMeetingActive
                            ? "Видео уулзалт идэвхтэй байна"
                            : "Видео уулзалт эхлээгүй байна"}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {isMeetingActive
                            ? "Уулзалтад нэгдэхийн тулд доорх товчийг дарна уу"
                            : user?.uid === event.createdBy
                            ? "Та зохион байгуулагч тул уулзалтыг эхлүүлэх боломжтой"
                            : "Эвент эхлэх үед видео уулзалт идэвхжинэ"}
                        </p>
                        <Button
                          onClick={handleStartMeeting}
                          disabled={
                            !user ||
                            (!isMeetingActive &&
                              user.uid !== event.createdBy) ||
                            rsvpStatus !== "going"
                          }
                        >
                          {user?.uid === event.createdBy && !isMeetingActive
                            ? "Уулзалт эхлүүлэх"
                            : "Уулзалтад орох"}
                        </Button>

                        {user && rsvpStatus !== "going" && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Уулзалтад оролцохын тулд "Тийм" гэж RSVP-г сонгоно
                            уу
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="border rounded-lg p-6 space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-bold">Оролцох уу?</h2>
                <div className="flex gap-2">
                  <Button
                    variant={rsvpStatus === "going" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => handleRSVP("going")}
                    disabled={!user}
                  >
                    Тийм
                  </Button>
                  <Button
                    variant={rsvpStatus === "maybe" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => handleRSVP("maybe")}
                    disabled={!user}
                  >
                    Магадгүй
                  </Button>
                  <Button
                    variant={rsvpStatus === "not-going" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => handleRSVP("not-going")}
                    disabled={!user}
                  >
                    Үгүй
                  </Button>
                </div>

                {!user && (
                  <p className="text-sm text-muted-foreground text-center">
                    <Link
                      href="/auth/login"
                      className="text-primary hover:underline"
                    >
                      Нэвтэрснээр
                    </Link>{" "}
                    оролцох боломжтой
                  </p>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">Оролцогчид</h3>
                  <div className="flex items-center gap-1">
                    <Avatar className="h-4 w-4" />
                    <span>{attendees.length}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {attendees.slice(0, 12).map((attendee) => (
                    <Avatar key={attendee.id} className="h-8 w-8">
                      <AvatarImage
                        src={attendee.photoURL || undefined}
                        alt={attendee.displayName || "User"}
                      />
                      <AvatarFallback>
                        {attendee.displayName?.charAt(0) ||
                          attendee.id.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}

                  {attendees.length > 12 && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                      +{attendees.length - 12}
                    </div>
                  )}

                  {attendees.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Одоогоор оролцогч байхгүй байна
                    </p>
                  )}
                </div>
              </div>

              {user && user.uid !== event.createdBy && (
                <div className="pt-4 border-t">
                  <Link href={`/messages?userId=${event.createdBy}`}>
                    <Button variant="outline" className="w-full">
                      <MessageCircleIcon className="h-4 w-4 mr-2" />
                      Зохион байгуулагчтай холбогдох
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-bold mb-4">Санал болгож буй эвентүүд</h3>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ачааллаж байна...
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
