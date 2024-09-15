import { redirect } from "next/navigation";

import { auth } from "@specly/auth";

export default async function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  return <>{children}</>;
}
