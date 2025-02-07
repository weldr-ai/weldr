import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return <>{children}</>;
}
