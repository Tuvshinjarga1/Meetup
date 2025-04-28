"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  BarChart3Icon,
  CalendarIcon,
  CheckIcon,
  FlagIcon,
  SearchIcon,
  ShieldIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";

// User type definition
type User = {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role?: string;
  status?: string;
  createdAt?: string | Timestamp;
};

// Event type definition
type Event = {
  id: string;
  title: string;
  createdBy: string;
  organizerName?: string;
  date: string;
  time?: string;
  eventType?: string;
  attendees: { [userId: string]: { status: string; timestamp: string } };
  status?: string;
  createdAt?: Timestamp;
};

// Report type definition
type Report = {
  id: string;
  type: "user" | "event";
  reportedId: string;
  reportedName?: string;
  reason: string;
  reportedBy: string;
  reporterName?: string;
  date: Timestamp;
  status: "pending" | "resolved";
};

// Statistics type definition
type Statistics = {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  upcomingEvents: number;
  messagesPerDay: number;
  topEventTypes: { name: string; count: number }[];
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalUsers: 0,
    activeUsers: 0,
    totalEvents: 0,
    upcomingEvents: 0,
    messagesPerDay: 0,
    topEventTypes: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        router.push("/auth/login?redirect=/admin");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() || userDoc.data()?.role !== "admin") {
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/");
      }
    };

    checkAdminAccess();
  }, [user, router]);

  // Fetch users from Firebase
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(
          collection(db, "users"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(usersQuery);

        const usersData = querySnapshot.docs.map((docSnapshot) => {
          const userData = docSnapshot.data();
          return {
            id: docSnapshot.id,
            displayName: userData.displayName,
            email: userData.email,
            photoURL: userData.photoURL,
            role: userData.role || "user",
            status: userData.status || "active",
            createdAt: userData.createdAt,
          };
        });

        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users:", error);
        setError("Хэрэглэгчдийн мэдээллийг татахад алдаа гарлаа");
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  // Fetch events from Firebase
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsQuery = query(
          collection(db, "events"),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(eventsQuery);

        const eventsData = await Promise.all(
          querySnapshot.docs.map(async (docSnapshot) => {
            const eventData = docSnapshot.data();

            // Fetch organizer name
            let organizerName = "Хэрэглэгч";
            try {
              const organizerDoc = await getDoc(
                doc(db, "users", eventData.createdBy)
              );
              if (organizerDoc.exists()) {
                organizerName = organizerDoc.data().displayName || "Хэрэглэгч";
              }
            } catch (error) {
              console.error("Error fetching organizer:", error);
            }

            return {
              id: docSnapshot.id,
              title: eventData.title,
              createdBy: eventData.createdBy,
              organizerName,
              date: eventData.date,
              time: eventData.time,
              attendees: eventData.attendees || {},
              status: eventData.status || "active",
              createdAt: eventData.createdAt,
            };
          })
        );

        setEvents(eventsData);
      } catch (error) {
        console.error("Error fetching events:", error);
        setError("Эвентүүдийн мэдээллийг татахад алдаа гарлаа");
      }
    };

    if (user) {
      fetchEvents();
    }
  }, [user]);

  // Fetch reports from Firebase
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reportsQuery = query(
          collection(db, "reports"),
          orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(reportsQuery);

        const reportsData = await Promise.all(
          querySnapshot.docs.map(async (docSnapshot) => {
            const reportData = docSnapshot.data();

            // Fetch reported entity name
            let reportedName = "";
            if (reportData.type === "user") {
              try {
                const userDoc = await getDoc(
                  doc(db, "users", reportData.reportedId)
                );
                if (userDoc.exists()) {
                  reportedName = userDoc.data().displayName || "Хэрэглэгч";
                }
              } catch (error) {
                console.error("Error fetching reported user:", error);
              }
            } else if (reportData.type === "event") {
              try {
                const eventDoc = await getDoc(
                  doc(db, "events", reportData.reportedId)
                );
                if (eventDoc.exists()) {
                  reportedName = eventDoc.data().title || "Эвент";
                }
              } catch (error) {
                console.error("Error fetching reported event:", error);
              }
            }

            // Fetch reporter name
            let reporterName = "Хэрэглэгч";
            try {
              const reporterDoc = await getDoc(
                doc(db, "users", reportData.reportedBy)
              );
              if (reporterDoc.exists()) {
                reporterName = reporterDoc.data().displayName || "Хэрэглэгч";
              }
            } catch (error) {
              console.error("Error fetching reporter:", error);
            }

            return {
              id: docSnapshot.id,
              type: reportData.type,
              reportedId: reportData.reportedId,
              reportedName,
              reason: reportData.reason,
              reportedBy: reportData.reportedBy,
              reporterName,
              date: reportData.date,
              status: reportData.status || "pending",
            };
          })
        );

        setReports(reportsData);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setError("Тайлангуудыг татахад алдаа гарлаа");
      }
    };

    if (user) {
      fetchReports();
    }
  }, [user]);

  // Calculate statistics
  useEffect(() => {
    const calculateStatistics = async () => {
      try {
        // Get total users count
        const totalUsers = users.length;

        // Get active users count
        const activeUsers = users.filter(
          (user) => user.status === "active"
        ).length;

        // Get total events count
        const totalEvents = events.length;

        // Get upcoming events (events with dates in the future)
        const today = new Date();
        const upcomingEvents = events.filter((event) => {
          const eventDate = new Date(event.date);
          return eventDate > today;
        }).length;

        // Calculate messages per day (using a placeholder value)
        // In a real app, you'd query the messages collection and calculate this
        const messagesPerDay = 230;

        // Calculate top event types
        const eventTypesMap = new Map<string, number>();
        for (const event of events) {
          // Assuming event types are stored in the event data
          // You may need to adjust this based on your actual data structure
          const eventType = event.eventType || "Other";
          eventTypesMap.set(eventType, (eventTypesMap.get(eventType) || 0) + 1);
        }

        // Convert map to array and sort by count
        const topEventTypes = Array.from(eventTypesMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStatistics({
          totalUsers,
          activeUsers,
          totalEvents,
          upcomingEvents,
          messagesPerDay,
          topEventTypes,
        });

        setIsLoading(false);
      } catch (error) {
        console.error("Error calculating statistics:", error);
        setError("Статистик мэдээллийг тооцоолоход алдаа гарлаа");
        setIsLoading(false);
      }
    };

    if (users.length > 0 && events.length > 0) {
      calculateStatistics();
    }
  }, [users, events]);

  // Handle user status toggle
  const handleToggleUserStatus = async (
    userId: string,
    currentStatus: string
  ) => {
    try {
      const newStatus = currentStatus === "active" ? "banned" : "active";
      await updateDoc(doc(db, "users", userId), {
        status: newStatus,
      });

      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, status: newStatus } : user
        )
      );
    } catch (error) {
      console.error("Error updating user status:", error);
      setError("Хэрэглэгчийн төлөвийг өөрчлөхөд алдаа гарлаа");
    }
  };

  // Handle event delete
  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, "events", eventId));

      // Update local state
      setEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== eventId)
      );
    } catch (error) {
      console.error("Error deleting event:", error);
      setError("Эвентийг устгахад алдаа гарлаа");
    }
  };

  // Handle report resolve
  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, "reports", reportId), {
        status: "resolved",
      });

      // Update local state
      setReports((prevReports) =>
        prevReports.map((report) =>
          report.id === reportId ? { ...report, status: "resolved" } : report
        )
      );
    } catch (error) {
      console.error("Error resolving report:", error);
      setError("Тайланг шийдвэрлэхэд алдаа гарлаа");
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(
    (user) =>
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter events based on search term
  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organizerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="border-b">
          <div className="container flex items-center justify-between py-4">
            <Link href="/" className="text-2xl font-bold">
              MeetupMN
            </Link>
          </div>
        </header>
        <main className="flex-1 container py-8 flex items-center justify-center">
          <p className="text-muted-foreground">Ачааллаж байна...</p>
        </main>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="border-b">
          <div className="container flex items-center justify-between py-4">
            <Link href="/" className="text-2xl font-bold">
              MeetupMN
            </Link>
          </div>
        </header>
        <main className="flex-1 container py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  function logout(): void {
    signOut(auth);
    router.push("/auth/login");
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <Link href="/" className="text-2xl font-bold">
            MeetupMN
          </Link>
          <div className="flex items-center gap-4">
            {/* <Link href="/events">
              <Button variant="ghost">Эвентүүд</Button>
            </Link> */}
            <Link href="/dashboard">
              <Button variant="ghost" onClick={() => logout()}>
                Гарах
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <ShieldIcon className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Админ самбар</h1>
          </div>

          <div className="relative w-64">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Хайх..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Нийт хэрэглэгч
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <UsersIcon className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">
                  {statistics.totalUsers}
                </div>
                <Badge className="ml-auto">
                  +
                  {
                    users.filter((u) => {
                      const createdAt = u.createdAt;
                      if (!createdAt) return false;
                      const date =
                        createdAt instanceof Timestamp
                          ? createdAt.toDate()
                          : new Date(createdAt);
                      const today = new Date();
                      return date.toDateString() === today.toDateString();
                    }).length
                  }{" "}
                  өнөөдөр
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Идэвхтэй хэрэглэгч
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <UserIcon className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">
                  {statistics.activeUsers}
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  {statistics.totalUsers > 0
                    ? Math.round(
                        (statistics.activeUsers / statistics.totalUsers) * 100
                      )
                    : 0}
                  %
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Нийт эвент
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <CalendarIcon className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">
                  {statistics.totalEvents}
                </div>
                <Badge className="ml-auto">
                  +
                  {
                    events.filter((e) => {
                      const createdAt = e.createdAt;
                      if (!createdAt) return false;
                      const date = createdAt.toDate();
                      const today = new Date();
                      return date.toDateString() === today.toDateString();
                    }).length
                  }{" "}
                  өнөөдөр
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ирэх эвентүүд
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <CalendarIcon className="h-5 w-5 text-muted-foreground mr-2" />
                <div className="text-2xl font-bold">
                  {statistics.upcomingEvents}
                </div>
                <div className="ml-auto text-sm text-muted-foreground">
                  Ирэх 7 хоногт
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users">
              <UsersIcon className="h-4 w-4 mr-2" />
              Хэрэглэгчид
            </TabsTrigger>
            <TabsTrigger value="events">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Эвентүүд
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FlagIcon className="h-4 w-4 mr-2" />
              Тайлангууд
            </TabsTrigger>
            <TabsTrigger value="statistics">
              <BarChart3Icon className="h-4 w-4 mr-2" />
              Статистик
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Хэрэглэгчид</CardTitle>
                <CardDescription>
                  Системд бүртгэлтэй бүх хэрэглэгчид
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Хэрэглэгч</TableHead>
                      <TableHead>И-мэйл</TableHead>
                      <TableHead>Эрх</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Бүртгүүлсэн</TableHead>
                      <TableHead className="text-right">Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.photoURL || "/placeholder.svg"}
                                alt={user.displayName || ""}
                              />
                              <AvatarFallback>
                                {user.displayName?.charAt(0) || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span>{user.displayName || "Хэрэглэгч"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === "admin" ? "default" : "outline"
                            }
                          >
                            {user.role === "admin" ? "Админ" : "Хэрэглэгч"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.status === "active"
                                ? "outline"
                                : "destructive"
                            }
                            className={
                              user.status === "active"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-red-100 text-red-800 hover:bg-red-100"
                            }
                          >
                            {user.status === "active"
                              ? "Идэвхтэй"
                              : "Хориглосон"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.createdAt instanceof Timestamp
                            ? user.createdAt.toDate().toLocaleDateString()
                            : typeof user.createdAt === "string"
                            ? new Date(user.createdAt).toLocaleDateString()
                            : "Тодорхойгүй"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              // onClick={() =>
                              //   router.push(`/admin/users/${user.id}`)
                              // }
                            >
                              Харах
                            </Button>
                            {user.status === "active" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500 border-red-200 hover:bg-red-50"
                                onClick={() =>
                                  handleToggleUserStatus(
                                    user.id,
                                    user.status || "active"
                                  )
                                }
                              >
                                <XIcon className="h-4 w-4 mr-1" /> Хориглох
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-500 border-green-200 hover:bg-green-50"
                                onClick={() =>
                                  handleToggleUserStatus(
                                    user.id,
                                    user.status || "banned"
                                  )
                                }
                              >
                                <CheckIcon className="h-4 w-4 mr-1" />{" "}
                                Идэвхжүүлэх
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Эвентүүд</CardTitle>
                <CardDescription>
                  Системд бүртгэлтэй бүх эвентүүд
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Эвент</TableHead>
                      <TableHead>Зохион байгуулагч</TableHead>
                      <TableHead>Огноо</TableHead>
                      <TableHead>Оролцогчид</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{event.title}</TableCell>
                        <TableCell>{event.organizerName}</TableCell>
                        <TableCell>
                          {event.date} {event.time ? `, ${event.time}` : ""}
                        </TableCell>
                        <TableCell>
                          {Object.keys(event.attendees).length}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.status === "active"
                                ? "outline"
                                : "destructive"
                            }
                            className={
                              event.status === "active"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-red-100 text-red-800 hover:bg-red-100"
                            }
                          >
                            {event.status === "active"
                              ? "Идэвхтэй"
                              : "Цуцлагдсан"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/events/${event.id}`}>
                              <Button variant="outline" size="sm">
                                Харах
                              </Button>
                            </Link>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => handleDeleteEvent(event.id)}
                            >
                              <Trash2Icon className="h-4 w-4 mr-1" /> Устгах
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Тайлангууд</CardTitle>
                <CardDescription>
                  Хэрэглэгчдээс ирсэн санал, гомдол
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reports.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Төрөл</TableHead>
                        <TableHead>Мэдээлсэн зүйл</TableHead>
                        <TableHead>Шалтгаан</TableHead>
                        <TableHead>Мэдээлсэн хэрэглэгч</TableHead>
                        <TableHead>Огноо</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Үйлдэл</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            {report.type === "user" ? "Хэрэглэгч" : "Эвент"}
                          </TableCell>
                          <TableCell>{report.reportedName}</TableCell>
                          <TableCell>{report.reason}</TableCell>
                          <TableCell>{report.reporterName}</TableCell>
                          <TableCell>
                            {report.date instanceof Timestamp
                              ? report.date.toDate().toLocaleDateString()
                              : "Тодорхойгүй"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                report.status === "pending"
                                  ? "outline"
                                  : "default"
                              }
                              className={
                                report.status === "pending"
                                  ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                  : "bg-green-100 text-green-800 hover:bg-green-100"
                              }
                            >
                              {report.status === "pending"
                                ? "Хүлээгдэж буй"
                                : "Шийдвэрлэсэн"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {report.type === "user" ? (
                                <Link
                                  href={`/admin/users/${report.reportedId}`}
                                >
                                  <Button variant="outline" size="sm">
                                    Харах
                                  </Button>
                                </Link>
                              ) : (
                                <Link href={`/events/${report.reportedId}`}>
                                  <Button variant="outline" size="sm">
                                    Харах
                                  </Button>
                                </Link>
                              )}
                              {report.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-500 border-green-200 hover:bg-green-50"
                                  onClick={() => handleResolveReport(report.id)}
                                >
                                  <CheckIcon className="h-4 w-4 mr-1" />{" "}
                                  Шийдвэрлэх
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">
                      Одоогоор мэдээлэл алга байна
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Хэрэглэгчид</CardTitle>
                  <CardDescription>
                    Хэрэглэгчийн үйл ажиллагааны статистик
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between mb-2">
                        <h4 className="text-sm text-muted-foreground">
                          Идэвхтэй хэрэглэгчид
                        </h4>
                        <span className="text-sm font-medium">
                          {statistics.activeUsers} / {statistics.totalUsers}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-primary h-2.5 rounded-full"
                          style={{
                            width: statistics.totalUsers
                              ? `${
                                  (statistics.activeUsers /
                                    statistics.totalUsers) *
                                  100
                                }%`
                              : "0%",
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between mb-2">
                        <h4 className="text-sm text-muted-foreground">
                          Өдөрт илгээгддэг дундаж мессежийн тоо
                        </h4>
                        <span className="text-sm font-medium">
                          {statistics.messagesPerDay}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Эвентүүд</CardTitle>
                  <CardDescription>
                    Эвентүүдийн үйл ажиллагааны статистик
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm text-muted-foreground mb-4">
                        Топ категориуд
                      </h4>
                      <div className="space-y-3">
                        {statistics.topEventTypes.map((type) => (
                          <div key={type.name}>
                            <div className="flex justify-between mb-1">
                              <span className="text-sm">{type.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {type.count}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{
                                  width: `${
                                    (type.count / statistics.totalEvents) * 100
                                  }%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t py-6 bg-gray-50">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Link href="/" className="text-xl font-bold">
                MeetupMN
              </Link>
              <p className="text-gray-500 mt-1">
                © 2025 MeetupMN. Бүх эрх хуулиар хамгаалагдсан.
              </p>
            </div>
            <div className="flex gap-6">
              <Link href="/about" className="text-gray-500 hover:text-gray-900">
                Бидний тухай
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-900">
                Үйлчилгээний нөхцөл
              </Link>
              <Link
                href="/privacy"
                className="text-gray-500 hover:text-gray-900"
              >
                Нууцлалын бодлого
              </Link>
              <Link
                href="/contact"
                className="text-gray-500 hover:text-gray-900"
              >
                Холбоо барих
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
