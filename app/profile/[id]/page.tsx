"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageCircleIcon,
  BellIcon,
  CalendarIcon,
  UserPlusIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainNav } from "@/components/main-nav";
import { Footer } from "@/components/footer";
import { useAuth } from "@/contexts/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { use } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getUserNotifications,
  markNotificationAsRead,
  type NotificationData,
} from "@/lib/notification-service";

type PageParams = {
  id: string;
};

export default function ProfilePage(props: { params: Promise<PageParams> }) {
  const router = useRouter();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // React.use() ашиглаж params-ийг задлах
  const params = use(props.params);
  const userId = params.id;

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, "users", userId));

        if (userDoc.exists()) {
          setProfileUser({
            id: userId,
            ...userDoc.data(),
          });
        } else {
          setError("Хэрэглэгч олдсонгүй");
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching profile:", error);
        setError("Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа");
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [userId]);

  useEffect(() => {
    // Хэрэв профайл хэрэглэгч өөрөө бол нотификейшн унших
    const fetchNotifications = async () => {
      if (!user || user.uid !== userId) return;

      try {
        setLoadingNotifications(true);
        const userNotifications = await getUserNotifications(userId);
        setNotifications(userNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [user, userId]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "event_update":
      case "event_reminder":
        return <CalendarIcon className="h-5 w-5 text-primary" />;
      case "new_message":
        return <MessageCircleIcon className="h-5 w-5 text-primary" />;
      case "new_attendee":
        return <UserPlusIcon className="h-5 w-5 text-primary" />;
      default:
        return <BellIcon className="h-5 w-5 text-primary" />;
    }
  };

  const getNotificationLink = (notification: NotificationData) => {
    switch (notification.type) {
      case "event_update":
      case "event_reminder":
        return notification.eventId ? `/events/${notification.eventId}` : "#";
      case "new_message":
        return notification.senderId
          ? `/messages?userId=${notification.senderId}`
          : "/messages";
      case "new_attendee":
        return notification.eventId ? `/events/${notification.eventId}` : "#";
      default:
        return "#";
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Одоо";
    if (diffMins < 60) return `${diffMins} минутын өмнө`;
    if (diffHours < 24) return `${diffHours} цагийн өмнө`;
    if (diffDays < 7) return `${diffDays} өдрийн өмнө`;

    return date.toLocaleDateString();
  };

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

  if (error || !profileUser) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <h2 className="text-2xl font-bold mb-4">Хэрэглэгч олдсонгүй</h2>
            <p className="text-muted-foreground mb-6">
              {error || "Хэрэглэгч устгагдсан эсвэл буруу ID байна."}
            </p>
            <Button variant="outline" onClick={() => router.back()}>
              Буцах
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Determine if this is the user's own profile
  const isOwnProfile = user && user.uid === userId;

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Хэрэглэгчийн профайл</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="w-32 h-32">
                  <AvatarImage
                    src={profileUser.photoURL || undefined}
                    alt={profileUser.displayName || "User"}
                  />
                  <AvatarFallback className="text-4xl">
                    {profileUser.displayName?.charAt(0) ||
                      profileUser.email?.charAt(0) ||
                      "U"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <h2 className="text-2xl font-bold">
                    {profileUser.displayName || "Хэрэглэгч"}
                  </h2>

                  {profileUser.bio && (
                    <p className="text-muted-foreground">{profileUser.bio}</p>
                  )}

                  {user && !isOwnProfile && (
                    <Link href={`/messages?userId=${userId}`}>
                      <Button>
                        <MessageCircleIcon className="h-4 w-4 mr-2" />
                        Мессеж илгээх
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {profileUser.interests && profileUser.interests.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="font-medium">Сонирхол</h3>
                  <div className="flex flex-wrap gap-2">
                    {profileUser.interests.map(
                      (interest: string, index: number) => (
                        <span
                          key={index}
                          className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isOwnProfile && (
            <Tabs defaultValue="notifications">
              <TabsList className="mb-4">
                <TabsTrigger value="notifications">
                  <BellIcon className="h-4 w-4 mr-2" />
                  Мэдэгдлүүд
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle>Мэдэгдлүүд</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingNotifications ? (
                      <div className="py-8 text-center">
                        <p className="text-muted-foreground">
                          Ачааллаж байна...
                        </p>
                      </div>
                    ) : notifications.length > 0 ? (
                      <div className="space-y-4">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`border rounded-lg p-4 ${
                              !notification.read ? "bg-primary/5" : ""
                            }`}
                          >
                            <div className="flex gap-4">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                                {getNotificationIcon(notification.type)}
                              </div>

                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <h3 className="font-medium">
                                    {notification.title}
                                  </h3>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimestamp(notification.timestamp)}
                                  </span>
                                </div>
                                <p className="text-muted-foreground mt-1">
                                  {notification.message}
                                </p>

                                <div className="flex justify-between items-center mt-3">
                                  <Link
                                    href={getNotificationLink(notification)}
                                  >
                                    <Button
                                      variant="link"
                                      className="p-0 h-auto"
                                    >
                                      Харах
                                    </Button>
                                  </Link>

                                  {!notification.read && notification.id && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8"
                                      onClick={() =>
                                        handleMarkAsRead(notification.id!)
                                      }
                                    >
                                      Уншсан
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <BellIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">
                          Мэдэгдэл байхгүй байна
                        </h3>
                        <p className="text-muted-foreground">
                          Шинэ мэдэгдэл ирэх үед энд харагдана
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
