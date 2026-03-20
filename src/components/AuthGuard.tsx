"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // 1. Listen to auth state changes — catches session invalidation in real time
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event as string) === "USER_DELETED") {
        router.push("/login");
        router.refresh();
        return;
      }
      if (!session && event !== "INITIAL_SESSION") {
        router.push("/login");
        router.refresh();
      }
    });

    // 2. On mount: verify the user still exists in DB
    // (handles the case where deletion happened on another device)
    const verifyUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // getUser() calls the Supabase Auth server — if user was deleted,
      // it returns an error even if a local JWT still exists
      if (error || !user) {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
        return;
      }

      // Also verify the profile row still exists in public.profiles
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        // Profile deleted (account deletion) — force sign out
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }
    };

    void verifyUser();

    // 3. Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return <>{children}</>;
}
