import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@integramind/ui/accordion";
import { Badge } from "@integramind/ui/badge";

export function FAQs() {
  return (
    <div
      id="faqs"
      className="flex w-full max-w-screen-md scroll-mt-32 flex-col items-center gap-8 md:gap-20"
    >
      <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
        <Badge className="rounded-full border border-primary bg-background text-primary">
          FAQs
        </Badge>
        <h2 className="text-center text-2xl font-semibold leading-snug md:max-w-3xl md:text-4xl">
          Frequently Asked Questions
        </h2>
      </div>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <AccordionItem value="faq-1" className="rounded-xl border px-4">
          <AccordionTrigger className="text-start">
            When will you launch the product?
          </AccordionTrigger>
          <AccordionContent>
            We aim to launch a beta version by september 2024 for early
            adopters.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-2" className="rounded-xl border px-4">
          <AccordionTrigger className="text-start">
            How IntegraMind is different from other workflow automation tools?
          </AccordionTrigger>
          <AccordionContent>
            Other workflow automation platforms provide predefined building
            blocks and you can&apos;t go beyond that. If the platform that you
            are using doesn&apos;t provide specific integration or block you
            have to ask the platform developers to develop it for you. On the
            other hand, IntegraMind is built to be fully customizable. We only
            provide few primitives that you can compose to build and integrate
            anything you want.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-3" className="rounded-xl border px-4">
          <AccordionTrigger className="text-start">
            How IntegraMind is different from other no/low-code platforms?
          </AccordionTrigger>
          <AccordionContent>
            Usually no/low-code platforms are built to be intuitive but you
            still need some coding knowledge to use them if you want to build
            something custom to your needs. Also, they are hard to be customized
            because most of these platforms are very opinionated. The flow-based
            programming model with English lets you build fully-customized
            flows. We also don&apos;t impose any opinions about how things
            should be build. We provide you with few primitives that you can
            compose to build anything you want.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-4" className="rounded-xl border px-4">
          <AccordionTrigger className="text-start">
            Is this a replacement for software engineers?
          </AccordionTrigger>
          <AccordionContent>
            No. IntegraMind is not a replacement for software engineers. Our
            main aim is not to render software engineers obsolete but to make
            programming accessible to everyone as much as possible.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
