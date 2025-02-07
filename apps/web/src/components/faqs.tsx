import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@weldr/ui/accordion";
import { Badge } from "@weldr/ui/badge";

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
        <h2 className="text-center font-semibold text-2xl leading-snug md:max-w-3xl md:text-4xl">
          Frequently Asked Questions
        </h2>
      </div>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <AccordionItem value="faq-3" className="rounded-xl border px-4">
          <AccordionTrigger className="text-start">
            How Weldr is different from other no/low-code platforms?
          </AccordionTrigger>
          <AccordionContent>
            Usually, no/low-code platforms are designed to be intuitive but
            often lack sufficient customizability. Additionally, they typically
            come with too many conventions and a complex UI that requires a
            learning curve. Unlike other platforms, Weldr doesn&apos;t limit
            you. The novel programming paradigm provided by Weldr is designed to
            enable the creation of any custom solution you envision. We offer a
            few primitives that you can compose to build anything you want, all
            using English.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-4" className="rounded-xl border px-4">
          <AccordionTrigger className="text-start">
            Is this a replacement for software engineers?
          </AccordionTrigger>
          <AccordionContent>
            No, Weldr is not a replacement for software engineers. Our main goal
            isn&apos;t to replace software engineers but to make programming as
            accessible as possible for everyone.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
