import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  uploadImage,
  optimizeImage,
  deleteImage,
  getImageFromStorage,
} from "./image-service";

export type EventData = {
  id?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  isOnline: boolean;
  eventType: string;
  imageUrl?: string;
  createdBy: string;
  createdAt: string;
  meetingActive?: boolean;
  attendees: {
    [userId: string]: {
      status: "going" | "maybe" | "not-going";
      timestamp: string;
    };
  };
};

export const createEvent = async (
  eventData: Omit<EventData, "id" | "createdAt" | "attendees">,
  imageFile?: File
) => {
  try {
    // Add event document to Firestore
    const eventRef = await addDoc(collection(db, "events"), {
      ...eventData,
      createdAt: serverTimestamp(),
      attendees: {
        [eventData.createdBy]: {
          status: "going",
          timestamp: new Date().toISOString(),
        },
      },
    });

    // If there's an image, upload it to ImgDB (через наш сервис)
    if (imageFile) {
      // Оптимизаци хийх (шаардлагатай бол)
      const optimizedFile = await optimizeImage(imageFile);

      // ImgDB руу хуулах (image-service ашиглаж байна)
      const imagePath = `events/${eventRef.id}`;
      const imageUrl = await uploadImage(optimizedFile, imagePath);

      // Update event with image URL
      await updateDoc(doc(db, "events", eventRef.id), { imageUrl });
    }

    return eventRef.id;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
};

export const updateEvent = async (
  eventId: string,
  eventData: Partial<EventData>,
  imageFile?: File
) => {
  try {
    const eventRef = doc(db, "events", eventId);

    // Update event document
    await updateDoc(eventRef, {
      ...eventData,
      updatedAt: serverTimestamp(),
    });

    // If there's a new image, upload it to ImgDB
    if (imageFile) {
      // Оптимизаци хийх (шаардлагатай бол)
      const optimizedFile = await optimizeImage(imageFile);

      // ImgDB руу хуулах
      const imagePath = `events/${eventId}`;
      const imageUrl = await uploadImage(optimizedFile, imagePath);

      // Update event with new image URL
      await updateDoc(eventRef, { imageUrl });
    }

    return eventId;
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

export const deleteEvent = async (eventId: string) => {
  try {
    // Get the event data to check if it has an image
    const eventDoc = await getDoc(doc(db, "events", eventId));
    const eventData = eventDoc.data() as EventData;

    // If event has an image, delete it from ImgDB
    if (eventData && eventData.imageUrl) {
      await deleteImage(`events/${eventId}`);
    }

    // Delete the event document from Firestore
    await deleteDoc(doc(db, "events", eventId));
    return true;
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

export const getEvent = async (eventId: string) => {
  try {
    // Check if the eventId is valid
    if (!eventId || eventId === "create") {
      throw new Error("Invalid event ID");
    }

    const eventDoc = await getDoc(doc(db, "events", eventId));

    if (!eventDoc.exists()) {
      throw new Error("Event not found");
    }

    const eventData = {
      id: eventDoc.id,
      ...eventDoc.data(),
    } as EventData;

    // Локал зургийг шалгаж өөрчлөх
    if (eventData.imageUrl && eventData.imageUrl.startsWith("local://")) {
      const localImageUrl = getImageFromStorage(eventData.imageUrl);
      eventData.imageUrl = localImageUrl;
    }

    return eventData;
  } catch (error) {
    console.error("Error getting event:", error);
    throw error;
  }
};

export const getEvents = async (filters?: {
  eventType?: string;
  isOnline?: boolean;
  searchTerm?: string;
  userId?: string;
  attending?: boolean;
  limit?: number;
}) => {
  try {
    const eventsQuery = collection(db, "events");
    const constraints = [];

    // We need to be careful about combining filters with ordering
    // as this requires composite indexes in Firestore

    // Apply filters
    if (filters?.eventType) {
      constraints.push(where("eventType", "==", filters.eventType));
    }

    if (filters?.isOnline !== undefined) {
      constraints.push(where("isOnline", "==", filters.isOnline));
    }

    // Always order by date
    constraints.push(orderBy("date", "asc"));

    // Apply limit if specified
    if (filters?.limit) {
      constraints.push(limit(filters.limit));
    }

    // Create the query
    const q = query(eventsQuery, ...constraints);
    const querySnapshot = await getDocs(q);

    let events = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EventData[];

    // If we need to filter by userId, we'll do it client-side
    // to avoid the need for complex indexes
    if (filters?.userId) {
      if (filters.attending) {
        // Events the user is attending
        events = events.filter(
          (event) =>
            event.attendees &&
            event.attendees[filters.userId!] &&
            event.attendees[filters.userId!].status === "going"
        );
      } else {
        // Events created by the user
        events = events.filter((event) => event.createdBy === filters.userId);
      }
    }

    // Apply search filter if provided (client-side filtering)
    if (filters?.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      events = events.filter(
        (event) =>
          event.title.toLowerCase().includes(searchLower) ||
          event.description.toLowerCase().includes(searchLower)
      );
    }

    return events;
  } catch (error) {
    console.error("Error getting events:", error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
  }
};

export const updateRSVP = async (
  eventId: string,
  userId: string,
  status: "going" | "maybe" | "not-going"
) => {
  try {
    const eventRef = doc(db, "events", eventId);

    await updateDoc(eventRef, {
      [`attendees.${userId}`]: {
        status,
        timestamp: new Date().toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error("Error updating RSVP:", error);
    throw error;
  }
};

export const getEventAttendees = async (eventId: string) => {
  try {
    const eventDoc = await getDoc(doc(db, "events", eventId));

    if (!eventDoc.exists()) {
      throw new Error("Event not found");
    }

    const eventData = eventDoc.data() as EventData;
    const attendeeIds = Object.keys(eventData.attendees || {});

    // Get user details for each attendee
    const attendees = [];

    for (const userId of attendeeIds) {
      if (
        eventData.attendees[userId].status === "going" ||
        eventData.attendees[userId].status === "maybe"
      ) {
        const userDoc = await getDoc(doc(db, "users", userId));

        if (userDoc.exists()) {
          attendees.push({
            id: userId,
            status: eventData.attendees[userId].status,
            ...userDoc.data(),
          });
        }
      }
    }

    return attendees;
  } catch (error) {
    console.error("Error getting event attendees:", error);
    throw error;
  }
};
