import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditProfileClient } from "./EditProfileClient";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <EditProfileClient
      userId={user.id}
      userEmail={user.email ?? null}
    />
  );
}
