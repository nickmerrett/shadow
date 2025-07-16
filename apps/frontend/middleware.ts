import { NextRequest, NextResponse } from "next/server";
import { URL } from "url";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to auth page and static files
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // Check for session token in cookies
  const sessionToken = request.cookies.get("better-auth.session_token");

  // If no session token, redirect to auth page
  if (!sessionToken) {
    const authUrl = new URL("/auth", request.url);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
