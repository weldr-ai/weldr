import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@integramind/ui/accordion";

export function FAQs() {
  return (
    <div
      id="faqs"
      className="flex w-full max-w-screen-md scroll-mt-20 flex-col items-center gap-20"
    >
      <h2 className="max-w-3xl text-center text-4xl font-semibold leading-snug">
        Frequently Asked Questions
      </h2>
      <Accordion type="single" collapsible className="w-full space-y-2">
        <AccordionItem value="faq-1" className="rounded-xl border px-4">
          <AccordionTrigger>
            How the platform different than other workflow automation tools?
          </AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-2" className="rounded-xl border px-4">
          <AccordionTrigger>
            How the platform different than other no/low-code platforms?
          </AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-3" className="rounded-xl border px-4">
          <AccordionTrigger>
            Is this a replacement for software engineers?
          </AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="faq-4" className="rounded-xl border px-4">
          <AccordionTrigger>
            Will OpenAI render your product obsolete in future version?
          </AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
