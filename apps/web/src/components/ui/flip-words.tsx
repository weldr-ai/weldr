"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@weldr/ui/utils";

export const FlipWords = ({
  words,
  duration = 3000,
  className,
}: {
  words: string[];
  duration?: number;
  className?: string;
}) => {
  const [currentWord, setCurrentWord] = useState<string>(words[0] ?? "");
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const startAnimation = useCallback(() => {
    const word = words[words.indexOf(currentWord) + 1] ?? words[0] ?? "";
    setCurrentWord(word);
    setIsAnimating(true);
  }, [currentWord, words]);

  useEffect(() => {
    if (!isAnimating)
      setTimeout(() => {
        startAnimation();
      }, duration);
  }, [isAnimating, duration, startAnimation]);

  return (
    <AnimatePresence
      onExitComplete={() => {
        setIsAnimating(false);
      }}
    >
      <motion.div
        transition={{
          duration: 0.4,
          ease: "easeInOut",
        }}
        initial={{
          opacity: 0,
          x: 0,
          y: 0,
        }}
        animate={{
          opacity: 1,
          x: 0,
          y: 0,
        }}
        className={cn("relative inline-block text-left ", className)}
        key={currentWord}
      >
        {currentWord.split("").map((letter, idx) => (
          <motion.span
            key={`${idx}-${currentWord}`}
            initial={{ opacity: 0, y: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              delay: idx * 0.08,
            }}
          >
            {letter}
          </motion.span>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};
