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
} from "@/lib/call-service";

export default function MessagesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get("userId");

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

  // Fetch user's chats
  useEffect(() => {
    const fetchChats = async () => {
      if (!user) return;

      try {
        const userChats = await getUserChats(user.uid);
        setChats(userChats);

        // If there's an initialChatId from URL and it's not in the chats list,
        // we need to fetch that user's info and add it to the chats list
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

  // Subscribe to incoming calls
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToIncomingCalls(user.uid, (call) => {
      if (call && call.status === "pending") {
        setActiveCall(call);
        setIsOutgoingCall(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to active call updates
  useEffect(() => {
    if (!activeCall?.id) return;

    const unsubscribe = subscribeToCall(activeCall.id, (updatedCall) => {
      if (
        !updatedCall ||
        updatedCall.status === "ended" ||
        updatedCall.status === "rejected"
      ) {
        // Give a small delay to show the ended/rejected state before closing modal
        setTimeout(() => {
          setActiveCall(null);
        }, 2000);
      } else {
        setActiveCall(updatedCall);
      }
    });

    return () => unsubscribe();
  }, [activeCall?.id]);

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
    if (!user || !selectedChat) return;
    try {
      const callId = await startCall(user.uid, selectedChat, "video");
      // Subscribe to the call to get updates
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
    }
  };

  const handleAudioCall = async () => {
    if (!user || !selectedChat) return;
    try {
      const callId = await startCall(user.uid, selectedChat, "audio");
      // Subscribe to the call to get updates
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
    }
  };

  const handleCallClose = () => {
    setActiveCall(null);
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
                        <Avatar>
                          <AvatarImage
                            src={chat.user.photoURL || undefined}
                            alt={chat.user.displayName || "User"}
                          />
                          <AvatarFallback>
                            {chat.user.displayName?.charAt(0) ||
                              chat.userId.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {chat.unread > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium truncate">
                            {chat.user.displayName || "Хэрэглэгч"}
                          </h3>
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
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={selectedChatUser?.photoURL || undefined}
                        alt={selectedChatUser?.displayName || "User"}
                      />
                      <AvatarFallback>
                        {selectedChatUser?.displayName?.charAt(0) ||
                          selectedChat.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">
                        {selectedChatUser?.displayName || "Хэрэглэгч"}
                      </h3>
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
        />
      )}

      <Footer />
    </div>
  );
}
