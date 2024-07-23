"use client";

import { useSearchParams } from "next/navigation";

import { IntegraMindIcon } from "~/components/icons/integramind-icon";

export default function EmailSentConfirmation() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="flex w-full flex-col items-center justify-center gap-4">
        <IntegraMindIcon className="size-10" />
        <h3 className="text-xl">Check your email</h3>
        <div className="flex flex-col items-center justify-center">
          <p>We have sent a temporary login link.</p>
          <p>Please, check your inbox at</p>
        </div>
        <span className="font-semibold">{email}</span>
      </div>
    </div>
  );
}
