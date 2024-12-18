import { redirect } from "next/navigation";

import { auth } from "@integramind/auth";
import { headers } from "next/headers";

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  return <>{children}</>;
}
