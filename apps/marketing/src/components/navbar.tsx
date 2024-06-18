"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { Button } from "@integramind/ui/button";
import { cn } from "@integramind/ui/utils";

export function Navbar(): JSX.Element {
  const [isTop, setIsTop] = useState<boolean>(true);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    // Function to check if the page is at the top
    const checkIfPageIsAtTop = () => {
      if (window.scrollY === 0) {
        setIsTop(true);
      } else {
        setIsTop(false);
      }
    };

    checkIfPageIsAtTop();

    window.addEventListener("scroll", checkIfPageIsAtTop);

    return () => {
      window.removeEventListener("scroll", checkIfPageIsAtTop);
    };
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-2 z-50 flex w-full max-w-screen-lg items-center justify-between rounded-2xl border bg-background/60 px-3 py-2 shadow backdrop-blur-lg transition-all duration-500 md:top-4",
        {
          "max-w-screen-xl border-none shadow-none": isTop,
        },
      )}
    >
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
          className="hidden cursor-pointer hover:underline md:block"
          onClick={() => scrollToSection("features")}
        >
          Features
        </button>
        <button
          className="hidden cursor-pointer hover:underline md:block"
          onClick={() => scrollToSection("use-cases")}
        >
          Use Cases
        </button>
        <button
          className="hidden cursor-pointer hover:underline md:block"
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
