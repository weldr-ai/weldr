import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center">
      <SignUpForm />
    </main>
  );
}
