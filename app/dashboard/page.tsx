"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, MapPinIcon, PlusIcon, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { useAuth } from "@/contexts/auth-context";
import { getEvents, updateRSVP, type EventData } from "@/lib/event-service";
// import { FirebaseIndexNotice } from "@/components/firebase-index-notice"

export default function Dashboard() {
  const { user, userData } = useAuth();
  const [myEvents, setMyEvents] = useState<EventData[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<EventData[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // RSVP хандлах функц
  const handleRSVP = async (eventId: string | undefined) => {
    if (!user || !eventId) return;

    try {
      await updateRSVP(eventId, user.uid, "going");

      // Евентийг оролцож буй жагсаалтад нэмэх
      const event = recommendedEvents.find((e) => e.id === eventId);
      if (event) {
        setAttendingEvents((prev) => [
          ...prev,
          {
            ...event,
            attendees: {
              ...event.attendees,
              [user.uid]: {
                status: "going",
                timestamp: new Date().toISOString(),
              },
            },
          },
        ]);

        // Санал болгох жагсаалтаас хасах
        setRecommendedEvents((prev) => prev.filter((e) => e.id !== eventId));
      }
    } catch (error) {
      console.error("Error updating RSVP:", error);
    }
  };

  // RSVP цуцлах функц
  const handleCancelRSVP = async (eventId: string | undefined) => {
    if (!user || !eventId) return;

    try {
      await updateRSVP(eventId, user.uid, "not-going");

      // Оролцож буй жагсаалтаас хасах
      setAttendingEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error) {
      console.error("Error canceling RSVP:", error);
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        // Fetch events created by the user
        const userEvents = await getEvents({ userId: user.uid, limit: 5 });
        setMyEvents(userEvents);

        // Fetch events the user is attending
        const attending = await getEvents({ limit: 10 });
        // Filter client-side for attending events
        const attendingFiltered = attending
          .filter(
            (event) =>
              event.attendees &&
              event.attendees[user.uid] &&
              (event.attendees[user.uid].status === "going" ||
                event.attendees[user.uid].status === "maybe")
          )
          .slice(0, 5);
        setAttendingEvents(attendingFiltered);

        // Fetch recommended events based on user interests
        if (userData?.interests && userData.interests.length > 0) {
          // For simplicity, just get events of the first interest type
          // In a real app, you'd implement a more sophisticated recommendation system
          const recommended = await getEvents({
            eventType: userData.interests[0],
            limit: 5,
          });
          setRecommendedEvents(recommended);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        // Set empty arrays to avoid undefined errors
        setMyEvents([]);
        setAttendingEvents([]);
        setRecommendedEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [user, userData]);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        {/* <FirebaseIndexNotice /> */}
        <div className="flex flex-col md:flex-row gap-8">
          <div className="md:w-1/4">
            <Card>
              <CardHeader>
                <CardTitle>Миний профайл</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={userData?.photoURL || undefined}
                      alt={userData?.displayName || "User"}
                    />
                    <AvatarFallback className="text-2xl">
                      {userData?.displayName?.charAt(0) ||
                        user.email?.charAt(0) ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="mt-4 text-xl font-bold">
                    {userData?.displayName || "Хэрэглэгч"}
                  </h3>
                  <p className="text-muted-foreground">{user.email}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Сонирхол</h4>
                  <div className="flex flex-wrap gap-2">
                    {userData?.interests && userData.interests.length > 0 ? (
                      userData.interests.map((interest, index) => (
                        <span
                          key={index}
                          className="bg-primary/10 text-primary px-2 py-1 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Сонирхол тохируулаагүй байна
                      </p>
                    )}
                  </div>
                </div>

                <Link href="/profile/edit">
                  <Button variant="outline" className="w-full">
                    Профайл засах
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="md:w-3/4">
            <Tabs defaultValue="my-events">
              <div className="flex justify-between items-center mb-4">
                <TabsList>
                  <TabsTrigger value="my-events">Миний эвентүүд</TabsTrigger>
                  <TabsTrigger value="attending">Оролцох эвентүүд</TabsTrigger>
                  <TabsTrigger value="recommended">
                    Санал болгож буй
                  </TabsTrigger>
                </TabsList>

                <Link href="/events/create">
                  <Button>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Эвент үүсгэх
                  </Button>
                </Link>
              </div>

              <TabsContent value="my-events" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Миний үүсгэсэн эвентүүд</CardTitle>
                    <CardDescription>
                      Таны үүсгэсэн эвентүүдийн жагсаалт
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Ачааллаж байна...
                        </p>
                      </div>
                    ) : myEvents.length > 0 ? (
                      myEvents.map((event) => (
                        <div
                          className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-muted/50 rounded-md transition-colors"
                          key={event.id}
                        >
                          <Link
                            href={`/events/${event.id}`}
                            className="flex items-center gap-4 flex-1"
                          >
                            <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                              <img
                                src={
                                  event.imageUrl ||
                                  `/placeholder.svg?height=64&width=64&text=Эвент`
                                }
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold">{event.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <div className="flex items-center gap-1">
                                  <CalendarIcon size={14} />
                                  <span>{event.date}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPinIcon size={14} />
                                  <span>{event.location}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <UsersIcon size={14} />
                                  <span>
                                    {Object.keys(event.attendees || {}).length}{" "}
                                    хэрэглэгч
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
                          <div>
                            <Link href={`/events/${event.id}/edit`}>
                              <Button variant="outline" size="sm">
                                Засах
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Та одоогоор эвент үүсгээгүй байна
                        </p>
                        <Link
                          href="/events/create"
                          className="mt-2 inline-block"
                        >
                          <Button>Эвент үүсгэх</Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attending" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Оролцох эвентүүд</CardTitle>
                    <CardDescription>
                      Таны оролцохоор бүртгүүлсэн эвентүүд
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Ачааллаж байна...
                        </p>
                      </div>
                    ) : attendingEvents.length > 0 ? (
                      attendingEvents.map((event) => (
                        <div
                          className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-muted/50 rounded-md transition-colors"
                          key={event.id}
                        >
                          <Link
                            href={`/events/${event.id}`}
                            className="flex items-center gap-4 flex-1"
                          >
                            <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                              <img
                                src={
                                  event.imageUrl ||
                                  `/placeholder.svg?height=64&width=64&text=Эвент`
                                }
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold">{event.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <div className="flex items-center gap-1">
                                  <CalendarIcon size={14} />
                                  <span>{event.date}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPinIcon size={14} />
                                  <span>{event.location}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <UsersIcon size={14} />
                                  <span>
                                    {Object.keys(event.attendees || {}).length}{" "}
                                    хэрэглэгч
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelRSVP(event.id)}
                            >
                              Цуцлах
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Та одоогоор эвентэд бүртгүүлээгүй байна
                        </p>
                        <Link href="/events" className="mt-2 inline-block">
                          <Button>Эвентүүд харах</Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recommended" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Санал болгож буй эвентүүд</CardTitle>
                    <CardDescription>
                      Таны сонирхолд тохирсон эвентүүд
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Ачааллаж байна...
                        </p>
                      </div>
                    ) : recommendedEvents.length > 0 ? (
                      recommendedEvents.map((event) => (
                        <div
                          className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-muted/50 rounded-md transition-colors"
                          key={event.id}
                        >
                          <Link
                            href={`/events/${event.id}`}
                            className="flex items-center gap-4 flex-1"
                          >
                            <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden">
                              <img
                                src={
                                  event.imageUrl ||
                                  `/placeholder.svg?height=64&width=64&text=Эвент`
                                }
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold">{event.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <div className="flex items-center gap-1">
                                  <CalendarIcon size={14} />
                                  <span>{event.date}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MapPinIcon size={14} />
                                  <span>{event.location}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <UsersIcon size={14} />
                                  <span>
                                    {Object.keys(event.attendees || {}).length}{" "}
                                    хэрэглэгч
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
                          <div>
                            <Button
                              size="sm"
                              onClick={() => handleRSVP(event.id)}
                            >
                              Оролцох
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          {userData?.interests && userData.interests.length > 0
                            ? "Таны сонирхолд тохирсон эвент олдсонгүй"
                            : "Сонирхлоо тохируулснаар танд тохирсон эвентүүдийг санал болгоно"}
                        </p>
                        {!(
                          userData?.interests && userData.interests.length > 0
                        ) && (
                          <Link
                            href="/profile/edit"
                            className="mt-2 inline-block"
                          >
                            <Button>Сонирхол тохируулах</Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
