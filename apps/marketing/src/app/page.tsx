import Image from "next/image";

function Gradient({
  conic,
  className,
  small,
}: {
  small?: boolean;
  conic?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <span
      className={`absolute mix-blend-normal will-change-[filter] rounded-[100%] ${small ? "blur-[32px]" : "blur-[75px]"
        } ${conic ? "bg-glow-conic" : ""} ${className}`}
    />
  );
}

export default function Page(): JSX.Element {
  return (
    <main className="flex flex-col items-center justify-between min-h-screen p-24">
      <div className="relative flex place-items-center ">
        <div className="font-sans w-auto pb-16 pt-[48px] md:pb-24 lg:pb-32 md:pt-16 lg:pt-20 flex justify-between gap-8 items-center flex-col relative z-0">
          <div className="z-50 flex items-center justify-center w-full">
            <div className="absolute min-w-[614px] min-h-[614px]">
              <Image
                alt="Integra"
                height={614}
                src="circles.svg"
                width={614}
              />
            </div>
            <div className="absolute z-50 flex items-center justify-center w-64 h-64">
              <Gradient
                className="opacity-90 w-[120px] h-[120px]"
                conic
                small
              />
            </div>

            <div className="w-[120px] h-[120px] z-50">
              <Image
                alt=""
                height={120}
                priority
                src="integramind.svg"
                width={120}
              />
            </div>
          </div>
          <Gradient
            className="top-[-500px] opacity-[0.15] w-[1000px] h-[1000px]"
            conic
          />
          <div className="z-50 flex flex-col items-center justify-center space-y-2 gap-5 px-6 text-center lg:gap-6">
            <h1 className="text-6xl font-semibold">IntegraMind</h1>
            <div className="flex text-2xl font-semibold items-center space-x-6">
              <span>Automate</span>
              <span>•</span>
              <span>Optimize</span>
              <span>•</span>
              <span>Accelerate</span>
            </div>
            <div className="text-lg">We are building!</div>
          </div>
        </div>
      </div>
    </main>
  );
}
