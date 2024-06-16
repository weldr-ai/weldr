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
      className="flex w-full max-w-screen-md scroll-mt-20 flex-col items-center gap-20"
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <Badge className="rounded-full border border-primary bg-background text-primary">
          FAQs
        </Badge>
        <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
          Frequently Asked Questions
        </h2>
      </div>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <AccordionItem value="faq-1" className="rounded-xl border px-4">
          <AccordionTrigger>
            How IntegraMind is different from other workflow automation tools?
          </AccordionTrigger>
          <AccordionContent>
            Unlike other workflow automation tools to gives you predefined
            building block, IntegraMind is built to be fully customizable. We
            only provide few primitives that you can compose to build anything
            you want.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-2" className="rounded-xl border px-4">
          <AccordionTrigger>
            How IntegraMind is different from other no/low-code platforms?
          </AccordionTrigger>
          <AccordionContent>
            Usually no/low-code platforms are built to be intuitive but you
            still need some coding knowledge to use them if you want to build
            something custom to your needs. However, IntegraMind is built to be
            fully customizable with just English. You will never need any code
            nor you will see any code in the UI.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-3" className="rounded-xl border px-4">
          <AccordionTrigger>
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
