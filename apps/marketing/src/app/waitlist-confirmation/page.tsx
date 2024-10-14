import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@specly/ui/button";

export default function WaitlistConfirmationPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4">
      <Image
        className="size-20"
        alt="Specly"
        height={500}
        priority
        src="/logo-solid.png"
        width={500}
      />
      <p className="max-w-sm text-center">
        Thank you for your interest! We will get in touch with you soon.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        <ArrowLeft className="mr-2 size-4 stroke-1" />
        Back
      </Link>
    </div>
  );
}
