import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Service role for storage + admin.deleteUser; never use anon key here. */
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FileObject = { name: string; metadata: Record<string, unknown> | null };

function isStorageFile(item: FileObject): boolean {
  const size = (item.metadata as { size?: number } | null)?.size;
  return typeof size === "number";
}

/** Recursively remove all objects under a prefix (bug screenshots, nested folders). */
async function removeStoragePrefix(bucket: string, prefix: string): Promise<void> {
  const { data: items, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error || !items?.length) return;

  const pathsToRemove: string[] = [];

  for (const raw of items as FileObject[]) {
    const path = prefix ? `${prefix}/${raw.name}` : raw.name;
    if (isStorageFile(raw)) {
      pathsToRemove.push(path);
    } else {
      await removeStoragePrefix(bucket, path);
    }
  }

  if (pathsToRemove.length > 0) {
    await supabaseAdmin.storage.from(bucket).remove(pathsToRemove);
  }
}

function photoPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const fromPublic = url
    .split("/storage/v1/object/public/inspection-photos/")[1]
    ?.split("?")[0];
  if (fromPublic) return decodeURIComponent(fromPublic);
  const match = url.match(/inspection-photos\/(.+)/);
  return match ? decodeURIComponent(match[1].split("?")[0]) : null;
}

function reportPathFromUrl(reportUrl: string | null | undefined, inspectionId: string): string[] {
  const paths = new Set<string>();
  paths.add(`report_${inspectionId}.pdf`);
  if (reportUrl) {
    const fromPublic = reportUrl
      .split("/storage/v1/object/public/reports/")[1]
      ?.split("?")[0];
    if (fromPublic) paths.add(decodeURIComponent(fromPublic));
  }
  return Array.from(paths);
}

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
        report_url,
        tenancy_id,
        property_id,
        rooms ( id, photos ( id, url ) )
      `
      )
      .eq("agent_id", userId);

    if (inspErr) {
      return NextResponse.json({ error: inspErr.message }, { status: 500 });
    }

    const rows = (inspections ?? []) as Array<{
      id: string;
      report_url: string | null;
      tenancy_id: string | null;
      property_id: string | null;
      rooms: Array<{ id: string; photos: Array<{ id: string; url: string | null }> }> | null;
    }>;

    const photoPaths: string[] = [];
    const reportPaths: string[] = [];

    for (const row of rows) {
      const rooms = row.rooms ?? [];
      for (const room of rooms) {
        for (const p of room.photos ?? []) {
          const path = photoPathFromPublicUrl(p.url);
          if (path) photoPaths.push(path);
        }
      }
      reportPaths.push(...reportPathFromUrl(row.report_url, row.id));
    }

    try {
      const chunk = 80;
      for (let i = 0; i < photoPaths.length; i += chunk) {
        await supabaseAdmin.storage
          .from("inspection-photos")
          .remove(photoPaths.slice(i, i + chunk));
      }
      const uniqueReports = Array.from(new Set(reportPaths));
      for (let i = 0; i < uniqueReports.length; i += chunk) {
        await supabaseAdmin.storage
          .from("reports")
          .remove(uniqueReports.slice(i, i + chunk));
      }
    } catch (e) {
      console.error("account/delete storage (photos/reports) cleanup:", e);
    }

    try {
      await supabaseAdmin.storage.from("avatars").remove([
        `${userId}/avatar.jpg`,
        `signatures/${userId}/inspector-signature.png`,
      ]);
      await removeStoragePrefix("avatars", `bug-reports/${userId}`);
    } catch (e) {
      console.error("account/delete avatars bucket cleanup:", e);
    }

    try {
      await supabaseAdmin.storage.from("logos").remove([
        `${userId}/logo.jpg`,
        `${userId}/logo.svg`,
        `${userId}/logo.png`,
        `${userId}/logo.webp`,
      ]);
    } catch (e) {
      console.error("account/delete logos bucket cleanup:", e);
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
