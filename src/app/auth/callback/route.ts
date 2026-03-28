import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code       = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type       = requestUrl.searchParams.get("type") as
    | "magiclink" | "email" | "recovery" | "signup" | null;

  const supabase = await createClient();

  if (token_hash && type) {
    // OTP / magic link flow
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error("[auth/callback] verifyOtp error:", error.message);
      return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
    }
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  } else if (code) {
    // PKCE code exchange (used by password reset and OAuth)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
    }
    // Password reset uses PKCE + type=recovery
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/reset-password", request.url));
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
