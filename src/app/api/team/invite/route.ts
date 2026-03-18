import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

type ProfileWithCompany = {
  role: string | null;
  company_id: string | null;
  full_name: string | null;
  company:
    | {
        name?: string | null;
        logo_url?: string | null;
        primary_color?: string | null;
        max_users?: number | null;
      }
    | Array<{
        name?: string | null;
        logo_url?: string | null;
        primary_color?: string | null;
        max_users?: number | null;
      }>
    | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { email?: string };
    const rawEmail = (body.email ?? "").trim().toLowerCase();
    if (!rawEmail) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, company_id, full_name, company:companies(name, logo_url, primary_color, max_users)")
      .eq("id", user.id)
      .single<ProfileWithCompany>();

    if (profile?.role !== "owner") {
      return NextResponse.json({ error: "Only owners can invite" }, { status: 403 });
    }

    const company = Array.isArray(profile.company) ? profile.company[0] : profile.company;
    const companyId = profile.company_id;
    if (!companyId) {
      return NextResponse.json({ error: "No company found" }, { status: 400 });
    }

    const { data: memberCount } = await supabaseAdmin.rpc("get_company_member_count", {
      p_company_id: companyId,
    });

    const maxUsers = Number(company?.max_users ?? 0);
    if (maxUsers > 0 && Number(memberCount ?? 0) >= maxUsers) {
      return NextResponse.json(
        { error: "Team limit reached. Upgrade your plan to add more members." },
        { status: 403 }
      );
    }

    const { data: existingMember } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", rawEmail)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: "This person is already in your team" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const { data: pendingInvite } = await supabaseAdmin
      .from("company_invitations")
      .select("id, accepted_at, expires_at")
      .eq("email", rawEmail)
      .eq("company_id", companyId)
      .is("accepted_at", null)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (pendingInvite) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 400 }
      );
    }

    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from("company_invitations")
      .insert({
        company_id: companyId,
        invited_by: user.id,
        email: rawEmail,
        role: "inspector",
      })
      .select("token")
      .single<{ token: string }>();

    if (invitationError || !invitation?.token) {
      return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.snagify.net";
    const inviteUrl = `${appUrl}/invite?token=${invitation.token}`;
    const agencyName = company?.name || "Snagify";
    const primaryColor = company?.primary_color || "#9A88FD";
    const agencyLogo = company?.logo_url;

    const logoHtml = agencyLogo
      ? `<img src="${agencyLogo}" alt="${agencyName}" style="height:40px;border-radius:10px;object-fit:contain;" />`
      : `<span style="font-size:18px;font-weight:800;color:white;">${agencyName}</span>`;

    await resend.emails.send({
      from: `${agencyName} <noreply@snagify.net>`,
      to: rawEmail,
      subject: `You're invited to join ${agencyName} on Snagify`,
      html: `
<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <div style="background:${primaryColor};border-radius:16px;padding:20px 24px;margin-bottom:24px;">
    ${logoHtml}
  </div>
  <h2 style="font-size:22px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
    You're invited! 🎉
  </h2>
  <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
    <strong style="color:#1A1A2E;">${profile.full_name || "A team owner"}</strong> has invited you
    to join <strong style="color:#1A1A2E;">${agencyName}</strong> on Snagify —
    Dubai's property inspection platform.
  </p>
  <div style="background:#F8F7F4;border-radius:12px;padding:16px;margin-bottom:24px;">
    <table style="width:100%;font-size:13px;border-collapse:collapse;">
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Agency</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">${agencyName}</td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Your role</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">Inspector</td>
      </tr>
      <tr>
        <td style="color:#9B9BA8;padding:4px 0;">Invited by</td>
        <td style="color:#1A1A2E;font-weight:600;text-align:right;">${profile.full_name || "Owner"}</td>
      </tr>
    </table>
  </div>
  <a href="${inviteUrl}"
    style="display:block;background:${primaryColor};color:white;text-align:center;
    padding:16px 24px;border-radius:14px;font-size:15px;font-weight:800;
    text-decoration:none;margin-bottom:16px;">
    Accept invitation →
  </a>
  <p style="font-size:11px;color:#9B9BA8;text-align:center;line-height:1.5;">
    This invitation expires in 7 days.
    If you didn't expect this, you can safely ignore it.
  </p>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #F3F3F8;
    text-align:center;font-size:11px;color:#C4C4C4;">
    Powered by Snagify · app.snagify.net
  </div>
</div>`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Team invite error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
