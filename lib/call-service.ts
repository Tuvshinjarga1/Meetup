import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

export type CallData = {
  id?: string;
  callerId: string;
  receiverId: string;
  type: "audio" | "video";
  status: "pending" | "accepted" | "rejected" | "ended";
  timestamp: number;
  signalData?: any;
};

/**
 * Start a new call and store it in Firestore
 */
export async function startCall(
  callerId: string,
  receiverId: string,
  type: "audio" | "video"
): Promise<string> {
  try {
    const callData: Omit<CallData, "id"> = {
      callerId,
      receiverId,
      type,
      status: "pending",
      timestamp: Date.now(),
    };

    const callRef = await addDoc(collection(db, "calls"), callData);
    return callRef.id;
  } catch (error) {
    console.error("Error starting call:", error);
    throw error;
  }
}

/**
 * Accept an incoming call
 */
export async function acceptCall(callId: string): Promise<void> {
  try {
    const callRef = doc(db, "calls", callId);
    await updateDoc(callRef, {
      status: "accepted",
    });
  } catch (error) {
    console.error("Error accepting call:", error);
    throw error;
  }
}

/**
 * Reject an incoming call
 */
export async function rejectCall(callId: string): Promise<void> {
  try {
    const callRef = doc(db, "calls", callId);
    await updateDoc(callRef, {
      status: "rejected",
    });
  } catch (error) {
    console.error("Error rejecting call:", error);
    throw error;
  }
}

/**
 * End an ongoing call
 */
export async function endCall(callId: string): Promise<void> {
  try {
    const callRef = doc(db, "calls", callId);
    await updateDoc(callRef, {
      status: "ended",
    });
  } catch (error) {
    console.error("Error ending call:", error);
    throw error;
  }
}

/**
 * Delete a call record from the database
 */
export async function deleteCall(callId: string): Promise<void> {
  try {
    const callRef = doc(db, "calls", callId);
    await deleteDoc(callRef);
  } catch (error) {
    console.error("Error deleting call:", error);
    throw error;
  }
}

/**
 * Update the WebRTC signal data in a call
 */
export async function updateSignalData(
  callId: string,
  signalData: any
): Promise<void> {
  try {
    const callRef = doc(db, "calls", callId);
    await updateDoc(callRef, {
      signalData,
    });
  } catch (error) {
    console.error("Error updating signal data:", error);
    throw error;
  }
}

/**
 * Get call data for a specific call ID
 */
export async function getCall(callId: string): Promise<CallData | null> {
  try {
    const callRef = doc(db, "calls", callId);
    const callSnap = await getDoc(callRef);

    if (callSnap.exists()) {
      return {
        id: callSnap.id,
        ...callSnap.data(),
      } as CallData;
    }

    return null;
  } catch (error) {
    console.error("Error getting call:", error);
    throw error;
  }
}

/**
 * Subscribe to incoming calls for a user
 * @param userId The ID of the user to check for incoming calls
 * @param callback Callback function that receives the call data or null
 * @returns Unsubscribe function
 */
export function subscribeToIncomingCalls(
  userId: string,
  callback: (call: CallData | null) => void
): () => void {
  try {
    // Create a query for pending calls where the user is the receiver
    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", userId),
      where("status", "==", "pending")
    );

    // Listen for updates to the query
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }

      // Get the first pending call
      const call = snapshot.docs[0];
      callback({
        id: call.id,
        ...call.data(),
      } as CallData);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to incoming calls:", error);
    callback(null);
    return () => {};
  }
}

/**
 * Subscribe to updates for a specific call
 * @param callId The ID of the call to subscribe to
 * @param callback Callback function that receives the call data or null
 * @returns Unsubscribe function
 */
export function subscribeToCall(
  callId: string,
  callback: (call: CallData | null) => void
): () => void {
  try {
    const callRef = doc(db, "calls", callId);

    const unsubscribe = onSnapshot(callRef, (doc) => {
      if (!doc.exists()) {
        callback(null);
        return;
      }

      callback({
        id: doc.id,
        ...doc.data(),
      } as CallData);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to call:", error);
    callback(null);
    return () => {};
  }
}
