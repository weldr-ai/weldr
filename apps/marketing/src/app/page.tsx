import { CTA } from "~/components/cta";
import { FAQs } from "~/components/faqs";
import { Features } from "~/components/features";
import { Footer } from "~/components/footer";
import { Hero } from "~/components/hero";
import { Navbar } from "~/components/navbar";
import { UseCases } from "~/components/use-cases";

export default function Page(): JSX.Element {
  return (
    <main className="mx-auto flex w-full flex-col items-center gap-32 md:max-w-screen-lg lg:max-w-screen-xl">
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
