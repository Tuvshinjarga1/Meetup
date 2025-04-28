import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // For simplicity, we'll just check if the user has a session cookie
  // In a real app, you'd verify the session token with your auth provider

  const authPaths = [
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/verify-email",
  ];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Public paths that don't require authentication
  const publicPaths = [
    "/",
    "/events",
    "/about",
    "/terms",
    "/privacy",
    "/contact",
  ];
  const isPublicPath = publicPaths.some((path) =>
    path === "/"
      ? request.nextUrl.pathname === "/"
      : request.nextUrl.pathname.startsWith(path)
  );

  // Check if the path is for a specific event (these are public)
  const isEventDetailPath = /^\/events\/\d+$/.test(request.nextUrl.pathname);

  // If it's a public path or auth path, allow access
  if (isPublicPath || isAuthPath || isEventDetailPath) {
    return NextResponse.next();
  }

  // Firebase auth doesn't use traditional cookies that can be checked in middleware
  // We'll need to rely on client-side auth state checks instead
  // Let the page handle the authentication status
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
