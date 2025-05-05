"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendIcon, PhoneIcon, VideoIcon } from "lucide-react";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { useAuth } from "@/contexts/auth-context";
import {
  getUserChats,
  sendDirectMessage,
  subscribeToDirectMessages,
  type MessageData,
} from "@/lib/message-service";
import { useSearchParams } from "next/navigation";
import CallModal from "@/app/components/CallModal";
import {
  startCall,
  subscribeToIncomingCalls,
  subscribeToCall,
  type CallData,
  initializeSocket,
  disconnectSocket,
} from "@/lib/socket-service";
import Link from "next/link";

export default function MessagesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialChatId = searchParams?.get("userId") || null;

  const [selectedChat, setSelectedChat] = useState<string | null>(
    initialChatId
  );
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Call state
  const [activeCall, setActiveCall] = useState<CallData | null>(null);
  const [isOutgoingCall, setIsOutgoingCall] = useState(false);
  const [isCallButtonDisabled, setIsCallButtonDisabled] = useState(false);

  // Initialize socket.io when the user is available
  useEffect(() => {
    if (!user) return;

    let socketInitialized = false;
    let incomingCallUnsubscribe: (() => void) | null = null;

    const setupSocket = async () => {
      if (socketInitialized) return;

      try {
        setActiveCall(null);
        setIsOutgoingCall(false);

        await initializeSocket(user.uid);
        console.log("Socket.io initialized for user:", user.uid);
        socketInitialized = true;

        incomingCallUnsubscribe = subscribeToIncomingCalls((call) => {
          if (!call) return;

          if (call.status === "pending") {
            console.log("Incoming call detected:", call);
            call.receiverId = user.uid;
            setActiveCall(call);
            setIsOutgoingCall(false);
          }
        });
      } catch (error) {
        console.error("Error initializing socket:", error);
        socketInitialized = false;
      }
    };

    setupSocket();

    return () => {
      if (incomingCallUnsubscribe) {
        incomingCallUnsubscribe();
      }

      console.log("Cleaning up socket connection");
      setTimeout(() => {
        if (socketInitialized) {
          disconnectSocket();
        }
      }, 500);
    };
  }, [user]);

  // Fetch user's chats
  useEffect(() => {
    const fetchChats = async () => {
      if (!user) return;

      try {
        const userChats = await getUserChats(user.uid);
        setChats(userChats);

        if (
          initialChatId &&
          !userChats.find((chat) => chat.userId === initialChatId)
        ) {
          // This would fetch the user info and add it to the chats list
          // For simplicity, we're not implementing this now
        }

        setIsLoadingChats(false);
      } catch (error) {
        console.error("Error fetching chats:", error);
        setIsLoadingChats(false);
      }
    };

    fetchChats();
  }, [user, initialChatId]);

  // Subscribe to messages when a chat is selected
  useEffect(() => {
    if (!user || !selectedChat) return;

    setIsLoadingMessages(true);

    const unsubscribe = subscribeToDirectMessages(
      user.uid,
      selectedChat,
      (messagesData) => {
        setMessages(messagesData);
        setIsLoadingMessages(false);
      }
    );

    return () => unsubscribe();
  }, [user, selectedChat]);

  // Subscribe to active call updates
  useEffect(() => {
    if (!activeCall || !user) return;

    console.log("Setting up call subscription for call:", activeCall);

    const setupCallSubscription = async () => {
      try {
        await initializeSocket(user.uid);

        const unsubscribe = subscribeToCall((updatedCall) => {
          if (!updatedCall) return;

          console.log("Call update received:", updatedCall.status);

          if (
            updatedCall.status === "ended" ||
            updatedCall.status === "rejected"
          ) {
            setTimeout(() => {
              setActiveCall(null);
              setIsCallButtonDisabled(false);
            }, 2000);
          } else if (updatedCall.signalData) {
            setActiveCall((prev) => ({
              ...prev!,
              status: updatedCall.status,
              signalData: updatedCall.signalData,
            }));
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up call subscription:", error);
        return () => {};
      }
    };

    let unsubscribe: (() => void) | undefined;

    setupCallSubscription().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeCall, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user || !selectedChat) return;

    try {
      await sendDirectMessage(user.uid, selectedChat, message);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleVideoCall = async () => {
    if (!user || !selectedChat || isCallButtonDisabled) return;

    setIsCallButtonDisabled(true);

    try {
      console.log("Starting video call to:", selectedChat);
      await initializeSocket(user.uid);

      // Local video stream авах
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Local video харуулах
      const localVideo = document.getElementById(
        "local-video"
      ) as HTMLVideoElement;
      if (localVideo) {
        localVideo.srcObject = localStream;
      }

      const callId = await startCall(user.uid, selectedChat, "video");
      console.log("Created call with ID:", callId);

      const call = {
        id: callId,
        callerId: user.uid,
        receiverId: selectedChat,
        type: "video",
        status: "pending",
        timestamp: Date.now(),
      } as CallData;

      setActiveCall(call);
      setIsOutgoingCall(true);
    } catch (error) {
      console.error("Error starting video call:", error);
      alert("Дуудлага эхлүүлэхэд алдаа гарлаа. Дахин оролдоно уу.");
      setIsCallButtonDisabled(false);
    }
  };

  const handleAudioCall = async () => {
    if (!user || !selectedChat || isCallButtonDisabled) return;

    setIsCallButtonDisabled(true);

    try {
      console.log("Starting audio call to:", selectedChat);
      await initializeSocket(user.uid);

      // Local audio stream авах
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const callId = await startCall(user.uid, selectedChat, "audio");
      console.log("Created call with ID:", callId);

      const call = {
        id: callId,
        callerId: user.uid,
        receiverId: selectedChat,
        type: "audio",
        status: "pending",
        timestamp: Date.now(),
      } as CallData;

      setActiveCall(call);
      setIsOutgoingCall(true);
    } catch (error) {
      console.error("Error starting audio call:", error);
      alert("Дуудлага эхлүүлэхэд алдаа гарлаа. Дахин оролдоно уу.");
      setIsCallButtonDisabled(false);
    }
  };

  const handleCallClose = () => {
    console.log("Closing call modal");
    setActiveCall(null);
    setIsCallButtonDisabled(false);
  };

  const selectedChatUser = chats.find(
    (chat) => chat.userId === selectedChat
  )?.user;

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">
              Мессежүүдийг харахын тулд нэвтэрнэ үү
            </p>
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
        <h1 className="text-3xl font-bold mb-8">Мессежүүд</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px] border rounded-lg overflow-hidden">
          <div className="border-r">
            <div className="p-4 border-b">
              <Input placeholder="Хайх..." />
            </div>

            <div className="overflow-y-auto h-[calc(600px-65px)]">
              {isLoadingChats ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Ачааллаж байна...</p>
                </div>
              ) : chats.length > 0 ? (
                chats.map((chat) => (
                  <div
                    key={chat.userId}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedChat === chat.userId ? "bg-gray-50" : ""
                    }`}
                    onClick={() => setSelectedChat(chat.userId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Link
                          href={`/profile/${chat.userId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                            <AvatarImage
                              src={chat.user.photoURL || undefined}
                              alt={chat.user.displayName || "User"}
                            />
                            <AvatarFallback>
                              {chat.user.displayName?.charAt(0) ||
                                chat.userId.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        {chat.unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <Link
                            href={`/profile/${chat.userId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            <h3 className="font-medium truncate">
                              {chat.user.displayName || "Хэрэглэгч"}
                            </h3>
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {chat.timestamp?.toDate
                              ? new Date(
                                  chat.timestamp.toDate()
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        <p
                          className={`text-sm truncate ${
                            chat.unread > 0
                              ? "font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {chat.lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Одоогоор мессеж байхгүй байна
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col">
            {selectedChat ? (
              <>
                <div className="p-4 border-b flex items-center justify-between z-50 relative">
                  <div className="flex items-center gap-3">
                    <Link href={`/profile/${selectedChat}`}>
                      <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                        <AvatarImage
                          src={selectedChatUser?.photoURL || undefined}
                          alt={selectedChatUser?.displayName || "User"}
                        />
                        <AvatarFallback>
                          {selectedChatUser?.displayName?.charAt(0) ||
                            selectedChat.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <Link
                        href={`/profile/${selectedChat}`}
                        className="hover:underline"
                      >
                        <h3 className="font-medium">
                          {selectedChatUser?.displayName || "Хэрэглэгч"}
                        </h3>
                      </Link>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAudioCall}
                      title="Аудио дуудлага"
                    >
                      <PhoneIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleVideoCall}
                      title="Видео дуудлага"
                    >
                      <VideoIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Ачааллаж байна...</p>
                    </div>
                  ) : messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderId === user.uid
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            msg.senderId === user.uid
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p>{msg.text}</p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.senderId === user.uid
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {msg.timestamp?.toDate
                              ? new Date(
                                  msg.timestamp.toDate()
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : new Date().toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">
                        Шинэ мессеж бичиж эхлүүлнэ үү
                      </p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Мессеж бичих..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button size="icon" onClick={handleSendMessage}>
                      <SendIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">Чат сонгоно уу</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Call Modal */}
      {activeCall && (
        <CallModal
          call={activeCall}
          isIncoming={!isOutgoingCall}
          onClose={handleCallClose}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <video
                id="local-video"
                autoPlay
                playsInline
                muted
                className="w-full h-full rounded-lg"
              />
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded">
                Та
              </div>
            </div>
            <div className="relative">
              <video
                id="remote-video"
                autoPlay
                playsInline
                className="w-full h-full rounded-lg"
              />
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-1 rounded">
                {selectedChatUser?.displayName || "Хэрэглэгч"}
              </div>
            </div>
          </div>
        </CallModal>
      )}

      <Footer />
    </div>
  );
}
