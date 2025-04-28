import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "./firebase"

export type NotificationType = "event_update" | "new_message" | "event_reminder" | "new_attendee"

export type NotificationData = {
  id?: string
  type: NotificationType
  title: string
  message: string
  userId: string
  read: boolean
  timestamp: any
  eventId?: string
  chatId?: string
  senderId?: string
}

// Create a notification
export const createNotification = async (notification: Omit<NotificationData, "id" | "timestamp" | "read">) => {
  try {
    const notificationRef = await addDoc(collection(db, "notifications"), {
      ...notification,
      timestamp: serverTimestamp(),
      read: false,
    })

    return notificationRef.id
  } catch (error) {
    console.error("Error creating notification:", error)
    throw error
  }
}

// Get notifications for a user
export const getUserNotifications = async (userId: string, limitCount = 50) => {
  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    )

    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as NotificationData[]
  } catch (error) {
    console.error("Error getting notifications:", error)
    throw error
  }
}

// Subscribe to notifications (real-time)
export const subscribeToNotifications = (userId: string, callback: (notifications: NotificationData[]) => void) => {
  const q = query(collection(db, "notifications"), where("userId", "==", userId), orderBy("timestamp", "desc"))

  return onSnapshot(q, (querySnapshot) => {
    const notifications = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as NotificationData[]

    callback(notifications)
  })
}

// Mark a notification as read
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    })

    return true
  } catch (error) {
    console.error("Error marking notification as read:", error)
    throw error
  }
}

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const q = query(collection(db, "notifications"), where("userId", "==", userId), where("read", "==", false))

    const querySnapshot = await getDocs(q)

    const updatePromises = querySnapshot.docs.map((doc) => updateDoc(doc.ref, { read: true }))

    await Promise.all(updatePromises)

    return true
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    throw error
  }
}

// Create event update notification for all attendees
export const notifyEventUpdate = async (eventId: string, title: string, message: string) => {
  try {
    // Get the event to find attendees
    const eventDoc = await doc(db, "events", eventId)
    const eventSnapshot = await getDocs(collection(eventDoc, "attendees"))

    const notificationPromises = eventSnapshot.docs.map((doc) => {
      const userId = doc.id

      return createNotification({
        type: "event_update",
        title,
        message,
        userId,
        eventId,
      })
    })

    await Promise.all(notificationPromises)

    return true
  } catch (error) {
    console.error("Error notifying event update:", error)
    throw error
  }
}
