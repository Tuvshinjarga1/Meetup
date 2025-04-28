"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BellIcon, CalendarIcon, CheckIcon, MessageCircleIcon, UserPlusIcon } from "lucide-react"
import { MainNav } from "@/components/main-nav"
import { Footer } from "@/components/footer"
import { useAuth } from "@/contexts/auth-context"
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationData,
} from "@/lib/notification-service"

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return

      try {
        const userNotifications = await getUserNotifications(user.uid)
        setNotifications(userNotifications)
        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching notifications:", error)
        setIsLoading(false)
      }
    }

    fetchNotifications()
  }, [user])

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)

      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
      )
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return

    try {
      await markAllNotificationsAsRead(user.uid)

      // Update local state
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "event_update":
      case "event_reminder":
        return <CalendarIcon className="h-5 w-5 text-primary" />
      case "new_message":
        return <MessageCircleIcon className="h-5 w-5 text-primary" />
      case "new_attendee":
        return <UserPlusIcon className="h-5 w-5 text-primary" />
      default:
        return <BellIcon className="h-5 w-5 text-primary" />
    }
  }

  const getNotificationLink = (notification: NotificationData) => {
    switch (notification.type) {
      case "event_update":
      case "event_reminder":
        return notification.eventId ? `/events/${notification.eventId}` : "#"
      case "new_message":
        return notification.senderId ? `/messages?userId=${notification.senderId}` : "/messages"
      case "new_attendee":
        return notification.eventId ? `/events/${notification.eventId}` : "#"
      default:
        return "#"
    }
  }

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return ""

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "Одоо"
    if (diffMins < 60) return `${diffMins} минутын өмнө`
    if (diffHours < 24) return `${diffHours} цагийн өмнө`
    if (diffDays < 7) return `${diffDays} өдрийн өмнө`

    return date.toLocaleDateString()
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen">
        <MainNav />
        <main className="flex-1 container py-8">
          <div className="flex items-center justify-center h-[400px]">
            <p className="text-muted-foreground">Мэдэгдлүүдийг харахын тулд нэвтэрнэ үү</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MainNav />

      <main className="flex-1 container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Мэдэгдлүүд</h1>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllAsRead}>
                Бүгдийг уншсан болгох
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <p className="text-muted-foreground">Ачааллаж байна...</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-4 ${!notification.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{notification.title}</h3>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(notification.timestamp)}</span>
                      </div>
                      <p className="text-muted-foreground mt-1">{notification.message}</p>

                      <div className="flex justify-between items-center mt-3">
                        <Link href={getNotificationLink(notification)}>
                          <Button variant="link" className="p-0 h-auto">
                            Харах
                          </Button>
                        </Link>

                        {!notification.read && notification.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => handleMarkAsRead(notification.id!)}
                          >
                            <CheckIcon className="h-4 w-4 mr-1" />
                            Уншсан
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 border rounded-lg">
                <BellIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Мэдэгдэл байхгүй байна</h3>
                <p className="text-muted-foreground">Шинэ мэдэгдэл ирэх үед энд харагдана</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
