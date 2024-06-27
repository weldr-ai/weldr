"use client";

import Image from "next/image";

import { JoinWaitlistForm } from "~/components/join-waitlist-form";
import { FlipWords } from "~/components/ui/flip-words";

export function Hero() {
  return (
    <div
      id="hero"
      className="flex size-full flex-col items-center justify-center gap-10"
    >
      <div className="absolute inset-0 z-0 size-full bg-[linear-gradient(to_right,#1111130d_1px,transparent_1px),linear-gradient(to_bottom,#1111130d_1px,transparent_1px)] bg-[size:128px_128px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_50%,transparent_100%)]"></div>
      <div className="z-10 flex h-36 flex-col items-center justify-center gap-2 text-4xl font-semibold md:gap-4 lg:text-6xl">
        <span>Build Custom</span>
        <FlipWords
          className="text-center text-primary"
          words={["Backend APIs", "Workflows", "Data Pipelines"]}
        />
      </div>
      <p className="z-10 max-w-2xl text-center text-base lg:text-xl">
        Our state-of-the-art platform allows you to build your own custom
        backend APIs, automate workflows, and data pipelines with no code, just
        English.
      </p>
      <div className="hidden md:block">
        <JoinWaitlistForm />
      </div>
      <div className="z-10 flex w-full items-center justify-center">
        <div className="rounded-[16px] border bg-muted p-1 md:p-2">
          <div className="rounded-[12px] border bg-foreground p-0.5">
            <Image
              className="rounded-xl"
              alt="IntegraMind Dashboard"
              height={1080}
              src="/dashboard.png"
              width={1920}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
