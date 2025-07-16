import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export default async function VerifyEmailPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center">
      <VerifyEmailForm />
    </main>
  );
}
