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
          messages.map((message) => {
            const isOwnMessage = message.user.id === user.uid;

            return (
              <div
                key={message.id}
                className={`flex ${
                  isOwnMessage ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[70%] ${
                    isOwnMessage ? "flex-row-reverse text-right" : ""
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={message.user.photoURL || undefined}
                      alt={message.user.displayName || "User"}
                    />
                    <AvatarFallback>
                      {message.user.displayName?.charAt(0) ||
                        message.user.id.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className={`p-2 rounded-lg ${
                      isOwnMessage ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{message.user.displayName || "Хэрэглэгч"}</span>
                      <span>
                        {message.timestamp?.toDate
                          ? message.timestamp.toDate().toLocaleString()
                          : new Date().toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{message.text}</p>
                  </div>
                </div>
              </div>
            );
          })
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
