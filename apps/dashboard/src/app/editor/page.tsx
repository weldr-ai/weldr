import { redirect } from "next/navigation";

import { auth } from "@integramind/auth";

import { Navbar } from "~/components/navbar";

export default async function Editor(): Promise<JSX.Element> {
  const session = await auth();
  if (!session) redirect("/auth/login");

  return (
    <main className="flex size-full flex-col gap-4 p-4 md:gap-8 md:p-8">
      <Navbar />
      <div className="flex items-center justify-center">
        <div>Editor</div>
      </div>
    </main>
  );
}
