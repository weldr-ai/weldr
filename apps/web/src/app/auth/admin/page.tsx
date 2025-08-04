import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@weldr/auth";
import { AdminView } from "./_view";

export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user.role !== "admin") {
    redirect("/");
  }

  return <AdminView />;
}
