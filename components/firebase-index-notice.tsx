// "use client";

// import { useState } from "react";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Button } from "@/components/ui/button";
// import { AlertCircle } from "lucide-react";

// export function FirebaseIndexNotice() {
//   const [dismissed, setDismissed] = useState(false);

//   if (dismissed) return null;

//   const PROJECT_ID =
//     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "meetup-e99d1";

//   return (
//     <Alert className="mb-6 bg-yellow-50 border-yellow-200">
//       <AlertCircle className="h-5 w-5 text-yellow-600" />
//       <AlertTitle className="text-yellow-800 font-medium">
//         Firestore indexes needed
//       </AlertTitle>
//       <AlertDescription className="text-yellow-700">
//         <p className="mb-2">
//           This application requires Firestore indexes to be created for optimal
//           performance. Please click the links below to create the necessary
//           indexes in your Firebase console:
//         </p>
//         <ul className="list-disc pl-5 mb-3 space-y-1">
//           <li>
//             <a
//               href={`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Ckxwcm9qZWN0cy9tZWV0dXAtZTk5ZDEzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9ldmVudHMvaW5kZXhlcy9fEAEaCAoEZGF0ZRABGhAKDGV2ZW50X3R5cGVzEAEYARoMCghfbmFtZV9fXxACIAI`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-600 hover:underline"
//             >
//               Events by event type & date
//             </a>
//           </li>
//           <li>
//             <a
//               href={`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Ckxwcm9qZWN0cy9tZWV0dXAtZTk5ZDEzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9ldmVudHMvaW5kZXhlcy9fEAEaCAoEZGF0ZRABGhAKCGlzT25saW5lEAEYARoMCghfbmFtZV9fXxACIAI`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-600 hover:underline"
//             >
//               Events by isOnline & date
//             </a>
//           </li>
//           <li>
//             <a
//               href={`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Cktwcm9qZWN0cy9tZWV0dXAtZTk5ZDEzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9ub3RpZmljYXRpb25zL2luZGV4ZXMvXxABGhEKBnVzZXJJZBABGAEaEgoJdGltZXN0YW1wEAIYARoMCghfbmFtZV9fXxACIAI`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-600 hover:underline"
//             >
//               Notifications by userId & timestamp
//             </a>
//           </li>
//           <li>
//             <a
//               href={`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9tZWV0dXAtZTk5ZDEzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9ldmVudE1lc3NhZ2VzL2luZGV4ZXMvXxABGhEKB2V2ZW50SWQQARgBGhIKCXRpbWVzdGFtcBACGAEaDAoIX25hbWVfX18QAiAC`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-600 hover:underline"
//             >
//               Event messages by eventId & timestamp
//             </a>
//           </li>
//           <li>
//             <a
//               href={`https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9tZWV0dXAtZTk5ZDEzL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9kaXJlY3RNZXNzYWdlcy9pbmRleGVzL18QARoPCgZjaGF0SWQQARgBGhIKCXRpbWVzdGFtcBACGAEaDAoIX25hbWVfX18QAiAC`}
//               target="_blank"
//               rel="noopener noreferrer"
//               className="text-blue-600 hover:underline"
//             >
//               Direct messages by chatId & timestamp
//             </a>
//           </li>
//         </ul>
//         <p className="text-sm text-yellow-600 mb-3">
//           Note: This is a one-time setup step for the database. Once indexes are
//           created, you can dismiss this message.
//         </p>
//         <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
//           Dismiss
//         </Button>
//       </AlertDescription>
//     </Alert>
//   );
// }
