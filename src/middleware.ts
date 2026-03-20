import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  /** Service-role onboarding must not be blocked by session checks. */
  if (path.startsWith("/api/onboarding")) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data?.claims?.role === "authenticated";

  const publicRoutes = [
    "/login",
    "/register",
    "/signup",
    "/invite",
    "/api/invite/verify",
    "/api/invite/accept",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    path === route || path.startsWith(`${route}/`)
  );
  const isAuthRoute = path === "/login" || path === "/register" || path === "/signup";
  const isAppRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/inspection") ||
    path.startsWith("/profile") ||
    path.startsWith("/property") ||
    path.startsWith("/properties") ||
    path.startsWith("/reports") ||
    path.startsWith("/install-guide");

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAuthenticated && isAppRoute && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/inspection",
    "/inspection/:path*",
    "/profile",
    "/profile/:path*",
    "/property",
    "/property/:path*",
    "/properties",
    "/properties/:path*",
    "/reports",
    "/reports/:path*",
    "/install-guide",
    "/install-guide/:path*",
    "/invite",
    "/login",
    "/register",
    "/signup",
    "/api/invite/verify",
    "/api/invite/accept",
    /** Unified onboarding (service role); early-return in middleware body — no auth gate */
    "/api/onboarding/:path*",
  ],
};
