import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ResetPasswordPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center">
      <ResetPasswordForm />
    </main>
  );
}
