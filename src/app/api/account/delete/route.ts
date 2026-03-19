import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Service role for storage + admin.deleteUser; never use anon key here. */
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(_req: Request) {
  try {
    // 1. Verify authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;
    console.log("[delete-account] Starting deletion for userId:", userId);

    // 2. Nullify storage.objects owner via SQL function
    // NON-BLOCKING — log error but always continue
    try {
      const { error: rpcError } = await supabaseAdmin.rpc("delete_user_account", {
        target_user_id: userId,
      });
      if (rpcError) console.error("[delete-account] RPC error (non-blocking):", rpcError);
      else console.log("[delete-account] RPC: storage.objects owner nullified ✅");
    } catch (e) {
      console.error("[delete-account] RPC exception (non-blocking):", e);
    }

    // 3. Delete physical files from all buckets
    // NON-BLOCKING per bucket — one failing bucket won't stop the rest
    const buckets = ["inspection-photos", "reports", "avatars", "logos", "signatures"];
    for (const bucket of buckets) {
      try {
        const { data: topLevel } = await supabaseAdmin.storage
          .from(bucket)
          .list(userId, { limit: 1000 });

        if (!topLevel || topLevel.length === 0) continue;

        for (const item of topLevel) {
          if (item.id === null) {
            const { data: subLevel } = await supabaseAdmin.storage
              .from(bucket)
              .list(`${userId}/${item.name}`, { limit: 1000 });
            if (subLevel && subLevel.length > 0) {
              for (const subItem of subLevel) {
                if (subItem.id === null) {
                  const { data: deepLevel } = await supabaseAdmin.storage
                    .from(bucket)
                    .list(`${userId}/${item.name}/${subItem.name}`, { limit: 1000 });
                  if (deepLevel && deepLevel.length > 0) {
                    const deepPaths = deepLevel.map(
                      (f) => `${userId}/${item.name}/${subItem.name}/${f.name}`
                    );
                    await supabaseAdmin.storage.from(bucket).remove(deepPaths);
                  }
                }
              }
              const subPaths = subLevel
                .filter((f) => f.id !== null)
                .map((f) => `${userId}/${item.name}/${f.name}`);
              if (subPaths.length > 0) {
                await supabaseAdmin.storage.from(bucket).remove(subPaths);
              }
            }
          }
        }
        const topPaths = topLevel
          .filter((f) => f.id !== null)
          .map((f) => `${userId}/${f.name}`);
        if (topPaths.length > 0) {
          await supabaseAdmin.storage.from(bucket).remove(topPaths);
        }
        console.log(`[delete-account] Bucket ${bucket} cleaned ✅`);
      } catch (e) {
        console.error(`[delete-account] Bucket ${bucket} cleanup failed (non-blocking):`, e);
      }
    }

    // 4. Delete auth user — CASCADE automatically deletes profiles + all child tables
    console.log("[delete-account] Calling auth.admin.deleteUser...");
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[delete-account] deleteUser FAILED:", deleteError);
      throw deleteError;
    }
    console.log("[delete-account] Auth user deleted ✅ — CASCADE handled profiles");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[delete-account] Fatal error:", err);
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err && "message" in err
        ? String((err as { message: unknown }).message)
        : "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
