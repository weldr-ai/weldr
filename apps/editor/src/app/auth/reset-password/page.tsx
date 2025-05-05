import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "../_components/reset-password-form";

export default async function ResetPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return <ResetPasswordForm />;
}
