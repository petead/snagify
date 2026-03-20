import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Deep cleanup under `{userId}/` for all team-related buckets (same strategy as account delete). */
async function cleanupInspectorStorage(supabaseAdmin: SupabaseClient, userId: string) {
  const buckets = ["inspection-photos", "reports", "avatars", "logos", "signatures"];
  for (const bucket of buckets) {
    try {
      const { data: topLevel } = await supabaseAdmin.storage.from(bucket).list(userId, { limit: 1000 });
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
      const topPaths = topLevel.filter((f) => f.id !== null).map((f) => `${userId}/${f.name}`);
      if (topPaths.length > 0) {
        await supabaseAdmin.storage.from(bucket).remove(topPaths);
      }
    } catch (e) {
      console.error(`[remove-inspector] Bucket ${bucket} cleanup failed (non-blocking):`, e);
    }
  }

  // Common explicit paths (signup / profile flows)
  try {
    await supabaseAdmin.storage.from("avatars").remove([`logos/${userId}/company-logo.png`]);
  } catch {
    /* ignore */
  }
  try {
    await supabaseAdmin.storage.from("signatures").remove([`signatures/${userId}/profile-signature.png`]);
  } catch {
    /* ignore */
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { inspectorId?: string; companyId?: string };
    const { inspectorId, companyId } = body;
    if (!inspectorId || !companyId) {
      return NextResponse.json({ error: "Missing inspectorId or companyId" }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await admin.rpc("delete_inspector", {
      p_inspector_id: inspectorId,
      p_company_id: companyId,
      p_requester_id: user.id,
    });

    if (error) throw error;

    const payload = data as { error?: string } | null;
    if (payload && typeof payload === "object" && payload.error) {
      return NextResponse.json({ error: payload.error }, { status: 403 });
    }

    await cleanupInspectorStorage(admin, inspectorId);

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(inspectorId);
    if (deleteUserError) throw deleteUserError;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Remove inspector error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
