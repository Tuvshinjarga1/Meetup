"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarIcon, MapPinIcon, UsersIcon, BellIcon } from "lucide-react";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { getEvents, type EventData } from "@/lib/event-service";
import { getImageFromStorage } from "@/lib/image-service";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Image from "next/image";

export default function Home() {
  const [topEvents, setTopEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<{ [key: string]: number }>(
    {}
  );
  const { user } = useAuth();
  const { toast } = useToast();

  // Эвентүүдийг ачааллах
  useEffect(() => {
    const fetchTopEvents = async () => {
      try {
        setIsLoading(true);
        // Бүх эвентийг авах
        const events = await getEvents({ limit: 20 });

        // Оролцогчдын тоогоор эрэмбэлэх
        sortAndSetTopEvents(events);
      } catch (error) {
        console.error("Error fetching top events:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopEvents();
  }, []);

  // Шинэ эвент болон оролцогчийн өөрчлөлтийг Real-time хянах
  useEffect(() => {
    // Эвентүүдийн коллекцид сонсогч тавих
    const eventCollection = collection(db, "events");
    const eventQuery = query(
      eventCollection,
      orderBy("createdAt", "desc"),
      limit(20)
    );

    // Real-time сонсогч
    const unsubscribeEvents = onSnapshot(eventQuery, (snapshot) => {
      const events: EventData[] = [];
      let hasNewEvent = false;

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          hasNewEvent = true;
        }
      });

      // Бүх эвентийг дахин авах
      snapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data(),
        } as EventData);
      });

      if (events.length > 0) {
        // Эвентүүдийг оролцогчийн тоогоор эрэмбэлж дахин тохируулах
        sortAndSetTopEvents(events);

        // Хэрэв шинэ эвент нэмэгдсэн бол мэдэгдэл үзүүлэх
        if (hasNewEvent) {
          toast({
            title: "Шинэчлэлт",
            description: "Эвентүүдийн жагсаалт шинэчлэгдлээ",
            duration: 3000,
          });
        }
      }
    });

    // Chat мессежийг хянах (хэрэв хэрэглэгч нэвтэрсэн бол)
    let unsubscribeChat = () => {};

    if (user) {
      // Чат коллекцид сонсогч тавих - зөвхөн шинэ чатыг хянах
      const chatQuery = query(
        collection(db, "chats"),
        orderBy("timestamp", "desc"),
        limit(10)
      );

      unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
        let hasNewMessage = false;

        // Шинэ мессеж байгаа эсэхийг шалгах
        snapshot.docChanges().forEach((change) => {
          if (
            change.type === "added" &&
            change.doc.data().senderId !== user.uid &&
            new Date(change.doc.data().timestamp).getTime() >
              new Date().getTime() - 30000
          ) {
            hasNewMessage = true;
            const eventId = change.doc.data().eventId;

            // Мэдэгдлийн тоолуурыг нэмэх
            if (eventId && typeof eventId === "string") {
              setNotifications((prev) => {
                const updatedNotifications = { ...prev };
                updatedNotifications[eventId as string] =
                  (updatedNotifications[eventId as string] || 0) + 1;
                return updatedNotifications;
              });
            }
          }
        });

        // Хэрэв шинэ мессеж ирсэн бол мэдэгдэл үзүүлэх
        if (hasNewMessage) {
          toast({
            title: "Шинэ чат мессеж",
            description: "Танд шинэ мессеж ирлээ",
            duration: 3000,
          });
        }
      });
    }

    // Цэвэрлэх функц
    return () => {
      unsubscribeEvents();
      unsubscribeChat();
    };
  }, [user, toast]);

  // Эвентүүдийг эрэмбэлж, топ 3-г тохируулах функц
  const sortAndSetTopEvents = (events: EventData[]) => {
    const sortedEvents = [...events].sort((a, b) => {
      const attendeesA = a.attendees ? Object.keys(a.attendees).length : 0;
      const attendeesB = b.attendees ? Object.keys(b.attendees).length : 0;
      return attendeesB - attendeesA; // Буурах эрэмбээр
    });

    const top3Events = sortedEvents.slice(0, 3);
    setTopEvents(top3Events);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1">
        <section className="py-16 container">
          {/* <img
            src="https://i.ibb.co/p6ZVfCbK/background.jpg"
            alt="MeetupMN"
            className="w-auto mb-4 rounded-3xl"
          /> */}

          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold">
              Хамгийн их оролцогчтой эвентүүд
            </h2>
            {Object.keys(notifications).length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <BellIcon className="text-primary h-6 w-6" />
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {Object.values(notifications).reduce(
                          (sum, count) => sum + count,
                          0
                        )}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Танд{" "}
                      {Object.values(notifications).reduce(
                        (sum, count) => sum + count,
                        0
                      )}{" "}
                      шинэ мессеж ирээд байна
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              // Ачааллаж байх үед loader харуулах
              Array(3)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="border rounded-lg overflow-hidden transition-all hover:shadow-md animate-pulse"
                  >
                    <div className="aspect-video bg-gray-200" />
                    <div className="p-4">
                      <div className="h-6 bg-gray-200 rounded mb-2 w-3/4" />
                      <div className="h-16 bg-gray-200 rounded mb-4" />
                      <div className="flex gap-4">
                        <div className="h-4 bg-gray-200 rounded w-20" />
                        <div className="h-4 bg-gray-200 rounded w-20" />
                        <div className="h-4 bg-gray-200 rounded w-20" />
                      </div>
                    </div>
                  </div>
                ))
            ) : topEvents.length > 0 ? (
              // Эвентүүдийг харуулах
              topEvents.map((event) => (
                <Link
                  href={`/events/${event.id}`}
                  key={event.id}
                  className="group"
                >
                  <div className="border rounded-lg overflow-hidden transition-all hover:shadow-md">
                    <div className="aspect-video bg-gray-100 relative">
                      {notifications && event.id && notifications[event.id] && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center z-10">
                          {notifications[event.id]}
                        </div>
                      )}
                      <img
                        src={
                          event.imageUrl ||
                          `/placeholder.svg?height=200&width=400&text=Эвент`
                        }
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-xl mb-2 group-hover:text-primary">
                        {event.title}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <CalendarIcon size={16} />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPinIcon size={16} />
                          <span>
                            {event.isOnline ? "Онлайн" : event.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <UsersIcon size={16} />
                          <span>
                            {Object.keys(event.attendees || {}).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              // Эвент олдохгүй бол
              <div className="col-span-3 text-center py-12">
                <p className="text-muted-foreground">
                  Одоогоор эвент байхгүй байна
                </p>
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <Link href="/events">
              <Button variant="outline">Бүх эвентүүд харах</Button>
            </Link>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">
              Яагаад MeetupMN?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <UsersIcon className="text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  Шинэ хүмүүстэй танилцах
                </h3>
                <p className="text-gray-600">
                  Таны сонирхолтой адил хүмүүстэй танилцаж, шинэ найзуудтай
                  болох боломж
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Сонирхолтой эвентүүд</h3>
                <p className="text-gray-600">
                  Таны сонирхолд тохирсон эвентүүдийг санал болгож, оролцох
                  боломжийг олгоно
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <MapPinIcon className="text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Хаана ч, хэзээ ч</h3>
                <p className="text-gray-600">
                  Онлайн болон биечлэн уулзалтуудад оролцох, өөрийн эвентийг
                  үүсгэх боломж
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
