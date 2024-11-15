import { JoinWaitlistForm } from "~/components/join-waitlist-form";

export function CTA() {
  return (
    <div
      id="cta"
      className="relative flex min-h-96 w-full scroll-mt-32 flex-col items-center justify-center gap-10 rounded-xl border bg-primary p-10 text-center"
    >
      <div className="z-10 flex flex-col gap-4 text-primary-foreground md:gap-10">
        <h2 className="text-2xl md:text-5xl">
          Ready to signup and join the waitlist?
        </h2>
        <p className="max-w-xs md:max-w-full">
          Sign up for our waitlist to get notified when we launch.
        </p>
      </div>
      <JoinWaitlistForm variant="secondary" />
    </div>
  );
}
