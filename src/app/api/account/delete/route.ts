import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Service role for storage + admin.deleteUser; never use anon key here. */
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKETS = [
  "inspection-photos",
  "reports",
  "avatars",
  "logos",
  "signatures",
] as const;

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("company_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) {
      console.error("account/delete profile fetch:", profileErr.message);
    }

    const { data: inspections, error: inspErr } = await supabaseAdmin
      .from("inspections")
      .select(
        `
        id,
        tenancy_id,
        rooms ( id )
      `
      )
      .eq("agent_id", userId);

    if (inspErr) {
      return NextResponse.json({ error: inspErr.message }, { status: 500 });
    }

    const rows = (inspections ?? []) as Array<{
      id: string;
      tenancy_id: string | null;
      rooms: Array<{ id: string }> | null;
    }>;

    // Nullify storage.objects owner — JS .schema('storage') is unreliable; use RPC instead.
    const { error: rpcError } = await supabaseAdmin.rpc("delete_user_account", {
      target_user_id: userId,
    });
    if (rpcError) {
      console.error("RPC cleanup error:", rpcError);
      // Log but don't block — attempt storage + auth delete anyway
    }

    // Delete storage files per bucket using list + remove (non-blocking per bucket).
    for (const bucket of STORAGE_BUCKETS) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list("", {
          search: userId,
        } as { limit?: number; offset?: number; search?: string; sortBy?: { column: string; order: string } });

        if (files && files.length > 0) {
          const paths = files.map((f) => f.name);
          await supabaseAdmin.storage.from(bucket).remove(paths);
        }

        const { data: folderFiles } = await supabaseAdmin.storage.from(bucket).list(userId);

        if (folderFiles && folderFiles.length > 0) {
          const folderPaths = folderFiles.map((f) => `${userId}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(folderPaths);
        }
      } catch (e) {
        console.error(`Storage cleanup failed for bucket ${bucket}:`, e);
      }
    }

    const inspectionIds = rows.map((r) => r.id);
    const roomIds = rows.flatMap((r) => (r.rooms ?? []).map((x) => x.id));

    if (inspectionIds.length > 0) {
      await supabaseAdmin.from("signatures").delete().in("inspection_id", inspectionIds);
    }
    if (roomIds.length > 0) {
      await supabaseAdmin.from("photos").delete().in("room_id", roomIds);
      await supabaseAdmin.from("rooms").delete().in("id", roomIds);
    }
    if (inspectionIds.length > 0) {
      await supabaseAdmin.from("audit_logs").delete().in("inspection_id", inspectionIds);
      await supabaseAdmin.from("inspections").delete().in("id", inspectionIds);
    }

    const tenancyIds = Array.from(
      new Set(rows.map((r) => r.tenancy_id).filter((id): id is string => Boolean(id)))
    );
    for (const tid of tenancyIds) {
      const { count } = await supabaseAdmin
        .from("inspections")
        .select("id", { count: "exact", head: true })
        .eq("tenancy_id", tid);
      if (count === 0) {
        await supabaseAdmin.from("tenancies").delete().eq("id", tid);
      }
    }

    await supabaseAdmin.from("properties").delete().eq("agent_id", userId);

    await supabaseAdmin.from("bug_reports").delete().eq("user_id", userId);

    await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", userId);

    const companyId = profile?.company_id as string | null | undefined;
    const role = profile?.role as string | null | undefined;
    if (companyId && role === "owner") {
      await supabaseAdmin.from("company_invitations").delete().eq("company_id", companyId);
      await supabaseAdmin.from("companies").delete().eq("id", companyId);
    }

    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("account/delete auth.admin.deleteUser:", deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete account";
    console.error("Account deletion error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
