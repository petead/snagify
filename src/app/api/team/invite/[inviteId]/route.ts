import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ProfileRow = {
  role: string | null;
  company_id: string | null;
};

type InviteRow = {
  id: string;
  company_id: string | null;
};

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { inviteId: string } }
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
      .single<ProfileRow>();

    if (callerProfile?.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can cancel invitations" },
        { status: 403 }
      );
    }

    const { data: invitation } = await supabaseAdmin
      .from("company_invitations")
      .select("id, company_id")
      .eq("id", params.inviteId)
      .single<InviteRow>();

    if (!invitation || invitation.company_id !== callerProfile.company_id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("company_invitations")
      .delete()
      .eq("id", params.inviteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Cancel invitation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
