import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
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

  const path = request.nextUrl.pathname;
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
    path === "/dashboard" ||
    path === "/inspection";

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
    "/invite",
    "/login",
    "/register",
    "/signup",
    "/api/invite/verify",
    "/api/invite/accept",
  ],
};
