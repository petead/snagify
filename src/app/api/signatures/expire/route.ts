import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { inspectionId } = await req.json();
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Missing inspectionId" },
        { status: 400 }
      );
    }

    const { data: insp } = await supabase
      .from("inspections")
      .select("status, signing_deadline, type")
      .eq("id", inspectionId)
      .single();

    if (!insp) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isCheckout = (insp.type ?? "")
      .toLowerCase()
      .includes("check-out");

    if (
      isCheckout &&
      insp.status === "completed" &&
      insp.signing_deadline &&
      new Date(insp.signing_deadline) < new Date()
    ) {
      await supabase
        .from("inspections")
        .update({ status: "expired" })
        .eq("id", inspectionId);

      return NextResponse.json({ expired: true });
    }

    return NextResponse.json({ expired: false });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[expire]", err);
    return NextResponse.json(
      { error: e.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
