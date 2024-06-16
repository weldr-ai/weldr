import { Button } from "@integramind/ui/button";
import { Input } from "@integramind/ui/input";

export function CTA() {
  return (
    <div
      id="cta"
      className="relative flex min-h-96 w-full scroll-mt-20 flex-col items-center justify-center gap-10 rounded-xl border bg-primary text-center"
    >
      <Noise />
      <div className="z-10 flex flex-col gap-10 text-primary-foreground">
        <h2 className="text-5xl">Ready to signup and join the waitlist?</h2>
        <p>Sign up for our waitlist to get notified when we launch.</p>
      </div>
      <div className="relative">
        <Input
          className="h-10 w-96 rounded-full"
          placeholder="Enter your email"
        />
        <Button
          variant="secondary"
          className="absolute right-1 top-1 rounded-full"
          size="sm"
        >
          Join Waitlist
        </Button>
      </div>
    </div>
  );
}

const Noise = () => {
  return (
    <div
      className="absolute inset-0 h-full w-full scale-[1.2] transform opacity-10 [mask-image:radial-gradient(#fff,transparent,75%)]"
      style={{
        backgroundImage: "url(/noise.webp)",
        backgroundSize: "30%",
      }}
    ></div>
  );
};
