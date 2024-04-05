import Image from "next/image";

function Gradient({ className }: { className?: string }): JSX.Element {
  return (
    <span
      className={`bg-glow-conic absolute rounded-[100%] mix-blend-normal blur-[32px] will-change-[filter] ${className}`}
    />
  );
}

export default function Page(): JSX.Element {
  return (
    <main className="flex h-screen flex-col items-center justify-center">
      <div className="relative flex place-items-center">
        <div className="relative z-0 flex w-auto flex-col items-center justify-center gap-8">
          <div className="z-50 flex w-full items-center justify-center">
            <div className="absolute md:min-h-[512px] md:min-w-[512px]">
              <Image
                alt="IntegraMind"
                height={512}
                src="circles.svg"
                width={512}
              />
            </div>
            <div className="absolute z-50 flex size-64 items-center justify-center">
              <Gradient className="size-[128px] opacity-90" />
            </div>
            <div className="z-50 size-[128px]">
              <Image
                alt="IntegraMind"
                height={128}
                priority
                src="logo.svg"
                width={128}
              />
            </div>
          </div>
          <div className="z-50 flex flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-xl font-semibold md:text-4xl">IntegraMind</h1>
            <div className="flex items-center gap-2 uppercase md:gap-4">
              <span>Build</span>
              <span>•</span>
              <span>Automate</span>
              <span>•</span>
              <span>Accelerate</span>
            </div>
            <p>We are building 🏗️</p>
          </div>
        </div>
      </div>
    </main>
  );
}
