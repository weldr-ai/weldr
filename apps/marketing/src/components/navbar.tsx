"use client";

import Image from "next/image";

import { Button } from "@integramind/ui/button";

export function Navbar(): JSX.Element {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav className="z-50 mt-6 flex w-full max-w-screen-xl items-center justify-between rounded-2xl border px-3 py-2 shadow">
      <Button
        variant="ghost"
        size="icon"
        className="hover:bg-transparent hover:underline"
        onClick={scrollToTop}
      >
        <Image src="/logo.svg" alt="IntegraMind" width={128} height={128} />
      </Button>
      <div className="flex items-center justify-center gap-10 text-sm">
        <button
          className="cursor-pointer hover:underline"
          onClick={() => scrollToSection("features")}
        >
          Features
        </button>
        <button
          className="cursor-pointer hover:underline"
          onClick={() => scrollToSection("use-cases")}
        >
          Use Cases
        </button>
        <button
          className="cursor-pointer hover:underline"
          onClick={() => scrollToSection("faqs")}
        >
          FAQs
        </button>
      </div>
      <Button className="rounded-xl" onClick={() => scrollToSection("cta")}>
        Join Waitlist
      </Button>
    </nav>
  );
}
