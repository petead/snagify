import { createClient } from "@supabase/supabase-js";

export async function DELETE(request: Request) {
  const { inspectionId } = await request.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: inspection } = await supabase
    .from("inspections")
    .select(
      `
      id, type, status, tenancy_id, property_id, report_url, agent_id,
      signatures (id, signer_type, otp_verified, signed_at),
      rooms (id, photos (id, url))
    `
    )
    .eq("id", inspectionId)
    .single();

  if (!inspection) {
    return Response.json({ error: "Inspection not found" }, { status: 404 });
  }

  const tenancyId = inspection.tenancy_id ?? null;
  const propertyId = inspection.property_id ?? null;

  // Block if any signature has been verified
  const sigs = (inspection.signatures ?? []) as {
    id: string;
    signer_type: string;
    otp_verified: boolean;
    signed_at: string | null;
  }[];
  const signedCount = sigs.filter((s) => !!s.signed_at).length;
  if (signedCount > 0) {
    const signerName = sigs.find((s) => !!s.signed_at)?.signer_type;
    return Response.json(
      { error: "SIGNED", signerType: signerName, signedCount },
      { status: 403 }
    );
  }

  // Block if check-in has an existing check-out
  if (inspection.type === "check-in" && inspection.tenancy_id) {
    const { data: checkOut } = await supabase
      .from("inspections")
      .select("id, status")
      .eq("tenancy_id", inspection.tenancy_id)
      .eq("type", "check-out")
      .maybeSingle();

    if (checkOut) {
      return Response.json(
        { error: "HAS_CHECKOUT", checkOutStatus: checkOut.status },
        { status: 403 }
      );
    }
  }

  const rooms = (inspection.rooms ?? []) as {
    id: string;
    photos: { id: string; url: string | null }[];
  }[];
  const roomIds = rooms.map((r) => r.id);
  const allPhotos = rooms.flatMap((r) => r.photos ?? []);

  // ─── STEP 1: Storage cleanup (do not block DB delete on failure) ─────
  try {
    // 1. Delete all photos from inspection-photos bucket
    if (allPhotos.length > 0) {
      const photoPaths = allPhotos
        .map((p) => {
          const url = p.url ?? "";
          const fromPublic = url.split("/storage/v1/object/public/inspection-photos/")[1]?.split("?")[0];
          if (fromPublic) return fromPublic;
          const match = url.match(/inspection-photos\/(.+)/);
          return match ? match[1].split("?")[0] : null;
        })
        .filter((p): p is string => Boolean(p));

      if (photoPaths.length > 0) {
        await supabase.storage.from("inspection-photos").remove(photoPaths);
      }
    }

    // 2. Delete PDF from reports bucket (current path + legacy flat names)
    const agentId = (inspection as { agent_id?: string | null }).agent_id ?? null;
    const pathsToRemove = new Set<string>();
    if (inspection.report_url) {
      const fromUrl =
        inspection.report_url
          .split("/storage/v1/object/public/reports/")[1]
          ?.split("?")[0] ?? null;
      if (fromUrl) pathsToRemove.add(fromUrl);
    }
    if (agentId) {
      pathsToRemove.add(`${agentId}/${inspectionId}/report.pdf`);
    }
    pathsToRemove.add(`report_${inspectionId}.pdf`);
    pathsToRemove.add(`${inspectionId}/${inspectionId}.pdf`);
    await supabase.storage.from("reports").remove(Array.from(pathsToRemove));
  } catch (storageErr) {
    console.error("Storage cleanup failed, proceeding with DB delete:", storageErr);
  }

  // ─── STEP 2: DB deletion in FK-safe order ─────────────────────────────
  await supabase.from("signatures").delete().eq("inspection_id", inspectionId);

  if (roomIds.length > 0) {
    await supabase.from("photos").delete().in("room_id", roomIds);
    await supabase.from("rooms").delete().in("id", roomIds);
  }

  await supabase
    .from("audit_logs")
    .delete()
    .eq("inspection_id", inspectionId);

  await supabase.from("inspections").delete().eq("id", inspectionId);

  // If check-in and no other inspection uses this tenancy, remove tenancy
  if (inspection.type === "check-in" && tenancyId) {
    const { data: otherInspections } = await supabase
      .from("inspections")
      .select("id")
      .eq("tenancy_id", tenancyId);

    if (!otherInspections || otherInspections.length === 0) {
      await supabase.from("tenancies").delete().eq("id", tenancyId);
    }
  }

  // If no inspections remain for this property, delete the property
  let propertyAutoDeleted = false;
  if (propertyId) {
    const { count } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId);

    if (count === 0) {
      await supabase.from("properties").delete().eq("id", propertyId);
      propertyAutoDeleted = true;
    }
  }

  return Response.json({ success: true, propertyAutoDeleted });
}
