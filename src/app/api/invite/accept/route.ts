import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type InvitationWithCompany = {
  id: string;
  email: string;
  company_id: string;
  expires_at: string;
  accepted_at: string | null;
  company:
    | { id?: string | null; name?: string | null }
    | Array<{ id?: string | null; name?: string | null }>
    | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      token?: string;
      fullName?: string;
      password?: string;
    };

    const token = (body.token ?? "").trim();
    const fullName = (body.fullName ?? "").trim();
    const password = body.password ?? "";

    if (!token || !fullName || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Token, full name and password (min 8 chars) are required" },
        { status: 400 }
      );
    }

    const { data: invitation } = await supabaseAdmin
      .from("company_invitations")
      .select("id, email, company_id, expires_at, accepted_at, company:companies(id, name)")
      .eq("token", token)
      .maybeSingle<InvitationWithCompany>();

    if (!invitation || invitation.accepted_at || new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    const { data: usersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (listUsersError) {
      return NextResponse.json({ error: listUsersError.message }, { status: 500 });
    }

    const existingUser = usersData.users.find(
      (u) => (u.email ?? "").toLowerCase() === invitation.email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          password,
          user_metadata: { ...(existingUser.user_metadata ?? {}), full_name: fullName },
          email_confirm: true,
        }
      );
      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
      }

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle<{ id: string }>();

      if (existingProfile) {
        await supabaseAdmin
          .from("profiles")
          .update({
            company_id: invitation.company_id,
            role: "inspector",
            full_name: fullName,
            account_type: "pro",
            onboarding_completed: true,
          })
          .eq("id", userId);
      } else {
        await supabaseAdmin.from("profiles").insert({
          id: userId,
          email: invitation.email,
          full_name: fullName,
          role: "inspector",
          account_type: "pro",
          company_id: invitation.company_id,
          onboarding_completed: true,
        });
      }
    } else {
      const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createUserError || !createdUser.user) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }

      userId = createdUser.user.id;

      await supabaseAdmin.from("profiles").insert({
        id: userId,
        email: invitation.email,
        full_name: fullName,
        role: "inspector",
        account_type: "pro",
        company_id: invitation.company_id,
        onboarding_completed: true,
      });
    }

    await supabaseAdmin
      .from("company_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      email: invitation.email,
    });
  } catch (err: unknown) {
    console.error("Accept invitation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
