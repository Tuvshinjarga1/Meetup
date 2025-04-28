import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "./firebase"

export type MessageData = {
  id?: string
  text: string
  senderId: string
  receiverId?: string
  eventId?: string
  timestamp: any
  read?: boolean
}

// Send a message in an event chat
export const sendEventMessage = async (eventId: string, senderId: string, text: string) => {
  try {
    const messageRef = await addDoc(collection(db, "eventMessages"), {
      eventId,
      senderId,
      text,
      timestamp: serverTimestamp(),
      read: false,
    })

    return messageRef.id
  } catch (error) {
    console.error("Error sending event message:", error)
    throw error
  }
}

// Get messages for an event
export const getEventMessages = async (eventId: string, limitCount = 50) => {
  try {
    const q = query(
      collection(db, "eventMessages"),
      where("eventId", "==", eventId),
      orderBy("timestamp", "asc"),
      limit(limitCount),
    )

    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MessageData[]
  } catch (error) {
    console.error("Error getting event messages:", error)
    throw error
  }
}

// Subscribe to event messages (real-time)
export const subscribeToEventMessages = (eventId: string, callback: (messages: MessageData[]) => void) => {
  const q = query(collection(db, "eventMessages"), where("eventId", "==", eventId), orderBy("timestamp", "asc"))

  return onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MessageData[]

    callback(messages)
  })
}

// Send a direct message to another user
export const sendDirectMessage = async (senderId: string, receiverId: string, text: string) => {
  try {
    // Create a unique chat ID that's the same regardless of who sends the message
    const chatId = [senderId, receiverId].sort().join("_")

    const messageRef = await addDoc(collection(db, "directMessages"), {
      chatId,
      senderId,
      receiverId,
      text,
      timestamp: serverTimestamp(),
      read: false,
    })

    return messageRef.id
  } catch (error) {
    console.error("Error sending direct message:", error)
    throw error
  }
}

// Get direct messages between two users
export const getDirectMessages = async (userId1: string, userId2: string, limitCount = 50) => {
  try {
    const chatId = [userId1, userId2].sort().join("_")

    const q = query(
      collection(db, "directMessages"),
      where("chatId", "==", chatId),
      orderBy("timestamp", "asc"),
      limit(limitCount),
    )

    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MessageData[]
  } catch (error) {
    console.error("Error getting direct messages:", error)
    throw error
  }
}

// Subscribe to direct messages (real-time)
export const subscribeToDirectMessages = (
  userId1: string,
  userId2: string,
  callback: (messages: MessageData[]) => void,
) => {
  const chatId = [userId1, userId2].sort().join("_")

  const q = query(collection(db, "directMessages"), where("chatId", "==", chatId), orderBy("timestamp", "asc"))

  return onSnapshot(q, (querySnapshot) => {
    const messages = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MessageData[]

    callback(messages)
  })
}

// Get all chats for a user
export const getUserChats = async (userId: string) => {
  try {
    // Get chats where the user is either sender or receiver
    const q1 = query(collection(db, "directMessages"), where("senderId", "==", userId), orderBy("timestamp", "desc"))

    const q2 = query(collection(db, "directMessages"), where("receiverId", "==", userId), orderBy("timestamp", "desc"))

    const [sent, received] = await Promise.all([getDocs(q1), getDocs(q2)])

    // Combine and deduplicate chats
    const chats = new Map()

    // Process sent messages
    sent.docs.forEach((doc) => {
      const data = doc.data() as MessageData
      const otherUserId = data.receiverId

      if (!chats.has(otherUserId)) {
        chats.set(otherUserId, {
          userId: otherUserId,
          lastMessage: data.text,
          timestamp: data.timestamp,
          unread: 0,
        })
      }
    })

    // Process received messages
    received.docs.forEach((doc) => {
      const data = doc.data() as MessageData
      const otherUserId = data.senderId

      if (!chats.has(otherUserId) || data.timestamp > chats.get(otherUserId).timestamp) {
        chats.set(otherUserId, {
          userId: otherUserId,
          lastMessage: data.text,
          timestamp: data.timestamp,
          unread: data.read ? 0 : 1,
        })
      } else if (!data.read) {
        chats.get(otherUserId).unread++
      }
    })

    // Get user details for each chat
    const chatList = []

    for (const [userId, chat] of chats.entries()) {
      const userDoc = await getDoc(doc(db, "users", userId))

      if (userDoc.exists()) {
        chatList.push({
          ...chat,
          user: {
            id: userId,
            ...userDoc.data(),
          },
        })
      }
    }

    // Sort by timestamp
    return chatList.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error("Error getting user chats:", error)
    throw error
  }
}
