import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@weldr/auth";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center">
      <ForgotPasswordForm />
    </main>
  );
}
