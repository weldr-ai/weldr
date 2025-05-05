import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "../_components/verify-email-form";

export default async function VerifyEmailPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return <VerifyEmailForm />;
}
