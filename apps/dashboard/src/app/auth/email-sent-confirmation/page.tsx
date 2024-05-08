"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";

export default function EmailSentConfirmation() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="flex w-full flex-col items-center justify-center gap-4">
        <Image
          alt="IntegraMind"
          height={40}
          priority
          src="/logo.svg"
          width={40}
        />
        <h3 className="text-xl">Check your email</h3>
        <div className="flex flex-col items-center justify-center">
          <p>We have sent a temporary login link.</p>
          <p>
            Please, check your inbox at{" "}
            <span className="font-semibold">{email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
