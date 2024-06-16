import Image from "next/image";

import { Card } from "@integramind/ui/card";

export function Features() {
  return (
    <div
      id="features"
      className="flex scroll-mt-20 flex-col items-center justify-center gap-20"
    >
      <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
        Making programming accessible to everyone
      </h2>
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="col-span-2 flex flex-col justify-center gap-8 p-8 shadow-none">
          <div className="h-[300px]">
            <Image
              className="object-fit size-full rounded-xl"
              src="/feature-1.svg"
              width={500}
              height={500}
              alt=""
            />
          </div>
          <div className="h-32 space-y-4">
            <h3 className="text-3xl font-semibold">No Code, Just English!</h3>
            <p className="max-w-md">
              With over 100,000 mothly active bot users, Gippity AI is the most
              popular AI platform for developers.
            </p>
          </div>
        </Card>
        <Card className="col-span-1 flex flex-col justify-center gap-8 p-8 shadow-none">
          <div className="h-[300px]">
            <Image
              className="object-fit size-full rounded-xl"
              src="/feature-2.svg"
              width={500}
              height={500}
              alt=""
            />
          </div>
          <div className="h-32 space-y-4">
            <h3 className="text-3xl font-semibold">Explainable</h3>
            <p className="max-w-md">
              If someone yells “stop!”, goes limp, or taps out, the fight is
              over.
            </p>
          </div>
        </Card>
        <Card className="col-span-1 flex flex-col justify-center gap-8 p-8 shadow-none">
          <div className="h-[300px]">
            <Image
              className="object-fit size-full rounded-xl"
              src="/feature-5.svg"
              width={500}
              height={500}
              alt=""
            />
          </div>
          <div className="h-32 space-y-4">
            <h3 className="text-3xl font-semibold">Deployless</h3>
            <p className="max-w-md">
              If someone yells “stop!”, goes limp, or taps out, the fight is
              over.
            </p>
          </div>
        </Card>
        <Card className="col-span-1 flex flex-col justify-center gap-8 p-8 shadow-none">
          <div className="h-[300px]">
            <Image
              className="object-fit size-full rounded-xl"
              src="/feature-3.png"
              width={500}
              height={500}
              alt=""
            />
          </div>
          <div className="h-32 space-y-4">
            <h3 className="text-3xl font-semibold">Customizable</h3>
            <p className="max-w-md">
              If someone yells “stop!”, goes limp, or taps out, the fight is
              over.
            </p>
          </div>
        </Card>
        <Card className="col-span-1 flex flex-col justify-center gap-8 p-8 shadow-none">
          <div className="h-[300px]">
            <Image
              className="object-fit size-full rounded-xl"
              src="/feature-4.svg"
              width={500}
              height={500}
              alt=""
            />
          </div>
          <div className="h-32 space-y-4">
            <h3 className="text-3xl font-semibold">Intuitive</h3>
            <p className="max-w-md">
              If someone yells “stop!”, goes limp, or taps out, the fight is
              over.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
