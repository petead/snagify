import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type BasicProfile = {
  role: string | null;
  company_id: string | null;
};

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single<BasicProfile>();

    if (callerProfile?.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can remove members" },
        { status: 403 }
      );
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, company_id")
      .eq("id", params.userId)
      .single<BasicProfile>();

    if (!targetProfile || targetProfile.company_id !== callerProfile.company_id) {
      return NextResponse.json({ error: "Member not in your company" }, { status: 403 });
    }

    if (targetProfile.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the owner" }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ company_id: null })
      .eq("id", params.userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Remove team member error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
