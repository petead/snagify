import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type InvitationRow = {
  id: string;
  email: string;
  role: string | null;
  expires_at: string;
  accepted_at: string | null;
  company:
    | {
        name?: string | null;
        logo_url?: string | null;
        primary_color?: string | null;
      }
    | Array<{
        name?: string | null;
        logo_url?: string | null;
        primary_color?: string | null;
      }>
    | null;
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const { data: invitation } = await supabaseAdmin
    .from("company_invitations")
    .select("id, email, role, expires_at, accepted_at, company:companies(name, logo_url, primary_color)")
    .eq("token", token)
    .maybeSingle<InvitationRow>();

  if (!invitation) {
    return NextResponse.json({ error: "invalid" }, { status: 404 });
  }

  if (invitation.accepted_at) {
    return NextResponse.json({ error: "already_used" }, { status: 400 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }

  const company = Array.isArray(invitation.company)
    ? invitation.company[0]
    : invitation.company;

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at,
      accepted_at: invitation.accepted_at,
      company,
    },
  });
}
