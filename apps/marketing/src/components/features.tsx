import Image from "next/image";
import {
  DatabaseIcon,
  MoreHorizontalIcon,
  RocketIcon,
  VariableIcon,
} from "lucide-react";

import { Badge } from "@integramind/ui/badge";

import { NotionIcon } from "./ui/icons/notion-icon";
import { PostgresqlIcon } from "./ui/icons/postgresql-icon";
import { SalesforceIcon } from "./ui/icons/salesforce-icon";
import { SlackIcon } from "./ui/icons/slack-icon";

export function Features() {
  return (
    <div
      id="features"
      className="flex scroll-mt-32 flex-col items-center justify-center gap-8 md:gap-20"
    >
      <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
        <Badge className="rounded-full border border-primary bg-background text-primary">
          Features
        </Badge>
        <h2 className="text-center text-2xl font-semibold leading-snug md:max-w-3xl md:text-4xl">
          Making programming accessible to everyone
        </h2>
      </div>
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        <div className="col-span-1 flex flex-col justify-center gap-4 p-6 shadow-none md:border lg:gap-8 lg:p-8 xl:col-span-2">
          <div className="dark flex h-[250px] w-full flex-col items-center justify-center gap-1 rounded-xl bg-background p-10 text-foreground lg:h-[300px]">
            <div className="flex w-full flex-wrap items-center gap-1 text-xs md:gap-1.5 lg:text-lg">
              From
              <span className="flex items-center rounded-md border bg-accent px-1.5 py-1 text-accent-foreground">
                <PostgresqlIcon className="mr-2 size-4" />
                Acme DB
              </span>
              get
              <span className="flex items-center rounded-md border bg-accent px-1.5 py-1 text-accent-foreground">
                <DatabaseIcon className="mr-2 size-4 text-primary" />
                employee.name
              </span>
              and
              <span className="flex items-center rounded-md border bg-accent px-1.5 py-1 text-accent-foreground">
                <DatabaseIcon className="mr-2 size-4 text-primary" />
                employee.salary
              </span>
              where
              <span className="flex items-center rounded-md border bg-accent px-1.5 py-1 text-accent-foreground">
                <DatabaseIcon className="mr-2 size-4 text-primary" />
                employee.id
              </span>
              equals to
              <span className="flex items-center rounded-md border bg-accent px-1.5 py-1 text-accent-foreground">
                <VariableIcon className="mr-2 size-4 text-primary" />
                id
              </span>
            </div>
          </div>
          <div className="space-y-2 lg:h-28 lg:space-y-4 xl:h-36">
            <h3 className="text-xl font-semibold lg:text-3xl">
              No Code, Just English!
            </h3>
            <p className="max-w-lg text-sm">
              No coding necessary, just English! IntegraMind lets you automate
              your workflows and build custom tools to solve your problems.
            </p>
          </div>
        </div>
        <div className="col-span-1 flex flex-col justify-center gap-4 p-6 shadow-none md:border lg:gap-8 lg:p-8">
          <div className="dark flex h-[250px] w-full flex-col items-center justify-center rounded-xl bg-background p-10 lg:h-[300px]">
            <div className="flex h-16 w-full items-center justify-center rounded-xl border border-pink-500 text-center text-sm text-pink-500 md:text-base">
              When order is placed
            </div>
            <div className="h-16 border-l" />
            <div className="flex h-16 w-full items-center justify-center rounded-xl border border-blue-500 text-center text-sm text-blue-500 md:text-base">
              Generate and send invoice
            </div>
          </div>
          <div className="space-y-2 lg:h-28 lg:space-y-4 xl:h-36">
            <h3 className="text-xl font-semibold lg:text-3xl">Explainable</h3>
            <p className="max-w-lg text-sm">
              IntegraMind&apos;s AI programming model is designed to be
              explainable, so users can easily build and maintain their custom
              flows.
            </p>
          </div>
        </div>
        <div className="col-span-1 flex flex-col justify-center gap-4 p-6 shadow-none md:border lg:gap-8 lg:p-8">
          <div className="flex items-center justify-center">
            <div className="dark h-[250px] w-[250px] items-center justify-center rounded-full bg-background p-10 lg:h-[300px] lg:w-[300px]">
              <div className="flex size-full items-center justify-center rounded-full border bg-accent">
                <RocketIcon className="size-20 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="space-y-2 lg:h-28 lg:space-y-4 xl:h-36">
            <h3 className="text-xl font-semibold lg:text-3xl">
              Instant Deployment
            </h3>
            <p className="max-w-lg text-sm">
              Build anything you want and deploy it with a single click. No
              infrastructure required, we handle everything for you.
            </p>
          </div>
        </div>
        <div className="col-span-1 flex flex-col justify-center gap-4 p-6 shadow-none md:border lg:gap-8 lg:p-8">
          <div className="dark flex h-[250px] w-full flex-col items-center justify-center gap-2 rounded-xl bg-background p-10 lg:h-[300px]">
            <div className="grid grid-cols-3 gap-2">
              <div className="size-12 rounded-xl border border-emerald-500" />
              <div className="size-12 rounded-xl bg-cyan-500" />
              <div className="size-12 rounded-xl bg-pink-500" />
              <div className="size-12 rounded-xl bg-amber-500" />
              <div className="size-12 rounded-xl bg-purple-500" />
              <div className="size-12 rounded-xl border border-indigo-500" />
              <div className="size-12 rounded-xl border border-fuchsia-500" />
              <div className="size-12 rounded-xl border border-blue-500" />
              <div className="size-12 rounded-xl bg-green-500" />
            </div>
          </div>
          <div className="space-y-2 md:space-y-4 lg:h-28 xl:h-36">
            <h3 className="text-xl font-semibold lg:text-3xl">Customizable</h3>
            <p className="max-w-lg text-sm">
              With flow-based programming and English, you can truly build
              anything you want.
            </p>
          </div>
        </div>
        <div className="col-span-1 flex flex-col justify-center gap-4 p-6 shadow-none md:border lg:gap-8 lg:p-8">
          <div className="dark flex h-[250px] w-full items-center justify-center rounded-xl bg-background p-10 lg:h-[300px]">
            <span className="text-9xl font-black text-muted-foreground">
              UX
            </span>
          </div>
          <div className="space-y-2 lg:h-28 lg:space-y-4 xl:h-36">
            <h3 className="text-xl font-semibold lg:text-3xl">Intuitive</h3>
            <p className="max-w-lg text-sm">
              No learning curve, no complicated interface. IntegraMind is built
              with emphasis on simplicity and ease of use.
            </p>
          </div>
        </div>
        <div className="col-span-1 flex flex-col justify-center gap-4 p-6 shadow-none md:border lg:gap-8 lg:p-8 xl:hidden">
          <div className="dark flex h-[250px] w-full items-center justify-center rounded-xl bg-background p-10 lg:h-[300px]">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex size-14 items-center justify-center rounded-xl border bg-background">
                <NotionIcon className="size-6" />
              </div>
              <div className="flex size-14 items-center justify-center rounded-xl border bg-background">
                <SlackIcon className="size-6" />
              </div>
              <div className="flex size-14 items-center justify-center rounded-xl border bg-background">
                <SalesforceIcon className="size-6" />
              </div>
              <div className="flex size-14 items-center justify-center rounded-xl border bg-background">
                <MoreHorizontalIcon className="text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="space-y-2 lg:h-28 lg:space-y-4 xl:h-36">
            <h3 className="text-xl font-semibold lg:text-3xl">Integrations</h3>
            <p className="max-w-lg text-sm">
              Out of the box integrations with popular tools.
            </p>
          </div>
        </div>
      </div>
      <div className="relative z-10 hidden flex-col items-center justify-center xl:flex">
        <Image
          className="object-fit z-0 w-full rounded-xl"
          src="/integrations.svg"
          width={500}
          height={500}
          alt=""
        />
        <div className="absolute top-28 flex flex-col items-center justify-center gap-6">
          <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
            Integrations
          </h2>
          <p>Out of the box integrations with popular tools.</p>
        </div>
        <div className="absolute -left-2.5 top-[50px] flex size-full items-center justify-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl border bg-background p-4">
            <NotionIcon />
          </div>
          <div className="flex size-14 items-center justify-center rounded-xl border bg-background p-4">
            <SlackIcon />
          </div>
          <div className="flex size-14 items-center justify-center rounded-xl border bg-background p-4">
            <SalesforceIcon />
          </div>
          <div className="flex size-14 items-center justify-center rounded-xl border bg-background p-4">
            <PostgresqlIcon />
          </div>
        </div>
      </div>
    </div>
  );
}
