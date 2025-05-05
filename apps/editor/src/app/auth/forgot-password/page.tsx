import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return <ForgotPasswordForm />;
}
