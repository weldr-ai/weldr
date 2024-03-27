import Image from "next/image";
import { Button } from "@repo/ui/components/ui/button"

function Gradient({
  className
}: {
  className?: string;
}): JSX.Element {
  return (
    <span
      className={`absolute bg-glow-conic mix-blend-normal will-change-[filter] rounded-[100%] blur-[32px] ${className}`}
    />
  );
}

export default function Page(): JSX.Element {
  return (
    <main className="flex flex-col items-center justify-center h-screen">
      <div className="relative flex place-items-center">
        <div className="w-auto flex justify-center gap-8 items-center flex-col relative z-0">
          <div className="z-50 flex items-center justify-center w-full">
            <div className="absolute md:min-w-[512px] md:min-h-[512px]">
              <Image
                alt="Integra"
                height={512}
                src="circles.svg"
                width={512}
              />
            </div>
            <div className="absolute z-50 flex items-center justify-center w-64 h-64">
              <Gradient className="opacity-90 w-[128px] h-[128px]" />
            </div>
            <div className="w-[128px] h-[128px] z-50">
              <Image
                alt=""
                height={128}
                priority
                src="integramind.svg"
                width={128}
              />
            </div>
          </div>
          <div className="z-50 flex flex-col items-center justify-center text-center gap-4">
            <h1 className="text-xl md:text-4xl font-semibold">IntegraMind</h1>
            <div className="flex uppercase items-center gap-2 md:gap-4">
              <span>Automate</span>
              <span>•</span>
              <span>Optimize</span>
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
