import { auth } from "@weldr/auth";
import { buttonVariants } from "@weldr/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/components/card";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./_components/change-password-form";
import { SessionsList } from "./_components/sessions-list";
import { UpdateEmailForm } from "./_components/update-email-form";
import { UpdateNameForm } from "./_components/update-name-form";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const sessions = await auth.api.listSessions({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="container mx-auto space-y-4 p-8">
      <Link
        href="/"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ArrowLeftIcon className="size-3.5" /> home
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UpdateNameForm session={session} />
          <UpdateEmailForm session={session} />
          <ChangePasswordForm />
          <SessionsList sessions={sessions} session={session} />
        </CardContent>
      </Card>
    </div>
  );
}
