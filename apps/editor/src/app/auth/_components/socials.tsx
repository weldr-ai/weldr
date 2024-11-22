"use client";

import { useState } from "react";

import { authClient } from "@integramind/auth/client";
import { Button } from "@integramind/ui/button";
import { GithubIcon } from "@integramind/ui/icons/github-icon";
import { GoogleIcon } from "@integramind/ui/icons/google-icon";
import { MicrosoftIcon } from "@integramind/ui/icons/microsoft-icon";
import { toast } from "@integramind/ui/use-toast";
import { cn } from "@integramind/ui/utils";
import { useTheme } from "next-themes";

export function Socials() {
  const { resolvedTheme: theme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function onSocialSignIn(provider: "github" | "microsoft" | "google") {
    await authClient.signIn.social({
      provider,
      callbackURL: "/",
      fetchOptions: {
        onResponse: () => {
          setIsSubmitting(false);
        },
        onRequest: () => {
          setIsSubmitting(true);
        },
        onError: (ctx) => {
          toast({
            title: "Failed to sign in",
            description: ctx.error?.message,
            variant: "destructive",
          });
        },
      },
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button
        className="w-full"
        variant="outline"
        size="icon"
        aria-disabled={isSubmitting}
        disabled={isSubmitting}
        onClick={() => onSocialSignIn("google")}
      >
        <GoogleIcon className="size-4" />
        <span className="sr-only">Google Logo</span>
      </Button>
      <Button
        className="w-full"
        variant="outline"
        size="icon"
        aria-disabled={isSubmitting}
        disabled={isSubmitting}
        onClick={() => onSocialSignIn("microsoft")}
      >
        <MicrosoftIcon className="size-4" />
        <span className="sr-only">Microsoft Logo</span>
      </Button>
      <Button
        className="w-full"
        variant="outline"
        size="icon"
        aria-disabled={isSubmitting}
        disabled={isSubmitting}
        onClick={() => onSocialSignIn("github")}
      >
        <GithubIcon
          className={cn("size-4", theme === "dark" && "fill-white")}
        />
        <span className="sr-only">Github Logo</span>
      </Button>
    </div>
  );
}
