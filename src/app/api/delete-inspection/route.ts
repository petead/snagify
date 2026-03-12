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
      id, type, status, tenancy_id,
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

  // Block if any signature has been verified
  const sigs = (inspection.signatures ?? []) as {
    id: string;
    signer_type: string;
    otp_verified: boolean;
    signed_at: string | null;
  }[];
  const signedCount = sigs.filter((s) => s.otp_verified).length;
  if (signedCount > 0) {
    const signerName = sigs.find((s) => s.otp_verified)?.signer_type;
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

  // Delete PDF from storage bucket
  try {
    await supabase.storage
      .from("reports")
      .remove([`${inspectionId}/${inspectionId}.pdf`]);
  } catch (err) {
    // Don't block deletion if storage cleanup fails
    console.error("Failed to delete PDF from storage:", err);
  }

  // Cascade delete — photos from storage first
  const rooms = (inspection.rooms ?? []) as {
    id: string;
    photos: { id: string; url: string | null }[];
  }[];
  const allPhotos = rooms.flatMap((r) => r.photos ?? []);

  if (allPhotos.length > 0) {
    const filePaths = allPhotos
      .map((p) => {
        const match = p.url?.match(/inspection-photos\/(.+)/);
        return match ? match[1] : null;
      })
      .filter((p): p is string => p !== null);

    if (filePaths.length > 0) {
      await supabase.storage.from("inspection-photos").remove(filePaths);
    }
  }

  const roomIds = rooms.map((r) => r.id);

  if (roomIds.length > 0) {
    await supabase.from("photos").delete().in("room_id", roomIds);
    await supabase.from("rooms").delete().in("id", roomIds);
  }

  await supabase.from("signatures").delete().eq("inspection_id", inspectionId);

  // audit_logs may not exist — ignore error
  await supabase
    .from("audit_logs")
    .delete()
    .eq("inspection_id", inspectionId);

  await supabase.from("inspections").delete().eq("id", inspectionId);

  // After deleting the inspection: if check-in, delete the associated tenancy when no other inspection uses it
  if (inspection.type === "check-in" && tenancyId) {
    const { data: otherInspections } = await supabase
      .from("inspections")
      .select("id")
      .eq("tenancy_id", tenancyId);

    if (!otherInspections || otherInspections.length === 0) {
      await supabase.from("tenancies").delete().eq("id", tenancyId);
    }
  }

  return Response.json({ success: true });
}
