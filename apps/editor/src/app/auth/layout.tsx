import { auth } from "@integramind/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return <>{children}</>;
}
