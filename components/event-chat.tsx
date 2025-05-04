"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  sendEventMessage,
  subscribeToEventMessages,
  type MessageData,
} from "@/lib/message-service";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

type EventChatProps = {
  eventId: string;
};

type MessageWithUser = MessageData & {
  user: {
    id: string;
    displayName: string | null;
    photoURL: string | null;
  };
};

export function EventChat({ eventId }: EventChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<MessageWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eventId) {
      setError("Invalid event ID");
      setIsLoading(false);
      return;
    }

    let unsubscribe: () => void = () => {};

    try {
      unsubscribe = subscribeToEventMessages(eventId, async (messagesData) => {
        const messagesWithUsers = await Promise.all(
          messagesData.map(async (msg) => {
            try {
              const userDoc = await getDoc(doc(db, "users", msg.senderId));
              return {
                ...msg,
                user: {
                  id: msg.senderId,
                  displayName: userDoc.exists()
                    ? userDoc.data().displayName
                    : null,
                  photoURL: userDoc.exists() ? userDoc.data().photoURL : null,
                },
              };
            } catch (error) {
              console.error("Error fetching user data:", error);
              return {
                ...msg,
                user: {
                  id: msg.senderId,
                  displayName: null,
                  photoURL: null,
                },
              };
            }
          })
        );

        setMessages(messagesWithUsers);
        setIsLoading(false);
      });
    } catch (error) {
      console.error("Error subscribing to messages:", error);
      setError("Чат ачааллахад алдаа гарлаа");
      setIsLoading(false);
    }

    return () => unsubscribe();
  }, [eventId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user) return;

    try {
      await sendEventMessage(eventId, user.uid, message);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (!user) {
    return (
      <div className="border rounded-lg p-4 h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">
          Чатад оролцохын тулд нэвтэрнэ үү
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 h-[400px] flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Ачааллаж байна...</p>
          </div>
        ) : messages.length > 0 ? (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.user.id === user?.uid ? "justify-end" : "justify-start"
              }`}
            >
              {msg.user.id !== user?.uid && (
                <Link href={`/profile/${msg.user.id}`}>
                  <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                    <AvatarImage
                      src={msg.user.photoURL || undefined}
                      alt={msg.user.displayName || "User"}
                    />
                    <AvatarFallback>
                      {msg.user.displayName?.charAt(0) || msg.user.id.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}

              <div
                className={`max-w-[70%] p-3 rounded-lg ${
                  msg.user.id === user?.uid
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.user.id !== user?.uid && (
                  <Link
                    href={`/profile/${msg.user.id}`}
                    className="hover:underline"
                  >
                    <h4
                      className={`text-sm font-medium mb-1 ${
                        msg.user.id === user?.uid
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {msg.user.displayName || "Хэрэглэгч"}
                    </h4>
                  </Link>
                )}
                <p>{msg.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.user.id === user?.uid
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {msg.timestamp?.toDate
                    ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </p>
              </div>

              {msg.user.id === user?.uid && (
                <Link href={`/profile/${msg.user.id}`}>
                  <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                    <AvatarImage
                      src={msg.user.photoURL || undefined}
                      alt={msg.user.displayName || "User"}
                    />
                    <AvatarFallback>
                      {msg.user.displayName?.charAt(0) || msg.user.id.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Одоогоор мессеж байхгүй байна
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

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
  );
}
