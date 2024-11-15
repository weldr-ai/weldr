import { CTA } from "~/components/cta";
import { FAQs } from "~/components/faqs";
import { Features } from "~/components/features";
import { Footer } from "~/components/footer";
import { Hero } from "~/components/hero";
import { Navbar } from "~/components/navbar";
import { UseCases } from "~/components/use-cases";

export default function Page(): JSX.Element {
  return (
    <main className="flex w-full flex-col items-center justify-center gap-20 px-4 md:max-w-screen-lg md:px-8 lg:max-w-screen-xl lg:gap-32">
      <Navbar />
      <Hero />
      <Features />
      <UseCases />
      <FAQs />
      <CTA />
      <Footer />
    </main>
  );
}
