import Image from "next/image";

import { Badge } from "@integramind/ui/badge";
import { Card } from "@integramind/ui/card";

import { NotionIcon } from "./ui/icons/notion-icon";
import { PostgresqlIcon } from "./ui/icons/postgresql-icon";
import { SalesforceIcon } from "./ui/icons/salesforce-icon";
import { SlackIcon } from "./ui/icons/slack-icon";

export function Features() {
  return (
    <div
      id="features"
      className="flex scroll-mt-20 flex-col items-center justify-center gap-20"
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <Badge className="rounded-full border border-primary bg-background text-primary">
          Features
        </Badge>
        <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
          Making programming accessible to everyone
        </h2>
      </div>
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
          <div className="h-36 space-y-4">
            <h3 className="text-3xl font-semibold">No Code, Just English!</h3>
            <p className="max-w-lg">
              No coding necessary, just English! IntegraMind lets non-technical
              users automate their workflows and build custom tools to solve
              their problems.
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
          <div className="h-36 space-y-4">
            <h3 className="text-3xl font-semibold">Explainable</h3>
            <p>
              IntegraMind&apos;s AI programming model is designed to be
              explainable, so users can understand how the system makes its
              decisions.
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
          <div className="h-36 space-y-4">
            <h3 className="text-3xl font-semibold">Deployless</h3>
            <p className="max-w-md">
              Build anything you want and deploy it with a single click. No
              infrastructure required.
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
          <div className="h-36 space-y-4">
            <h3 className="text-3xl font-semibold">Customizable</h3>
            <p className="max-w-md">
              Build and compose flows that are tailored to your needs.
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
          <div className="h-36 space-y-4">
            <h3 className="text-3xl font-semibold">Intuitive</h3>
            <p className="max-w-md">
              No learning curve, no complicated interface. IntegraMind is built
              with emphasis on simplicity and ease of use.
            </p>
          </div>
        </Card>
      </div>
      <div className="flex size-full flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-6">
          <Badge className="rounded-full border border-primary bg-background text-primary">
            Integrations
          </Badge>
          <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
            Integrations
          </h2>
          <p>Out of the box integrations with popular tools.</p>
        </div>
        <div className="relative z-10 flex items-center justify-center">
          <Image
            className="object-fit z-0 w-full rounded-xl"
            src="/integrations.svg"
            width={500}
            height={500}
            alt=""
          />
          <div className="absolute -left-2.5 top-[50px] flex size-full items-center justify-center gap-4">
            <div className="size-16 rounded-xl border bg-background p-4">
              <NotionIcon />
            </div>
            <div className="size-16 rounded-xl border bg-background p-4">
              <SlackIcon />
            </div>
            <div className="size-16 rounded-xl border bg-background p-4">
              <SalesforceIcon />
            </div>
            <div className="size-16 rounded-xl border bg-background p-4">
              <PostgresqlIcon />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
