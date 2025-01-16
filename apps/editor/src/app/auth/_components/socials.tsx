"use client";

import { useState } from "react";

import { authClient } from "@integramind/auth/client";
import { Button } from "@integramind/ui/button";
import { toast } from "@integramind/ui/hooks/use-toast";
import { GithubIcon } from "@integramind/ui/icons/github-icon";
import { GoogleIcon } from "@integramind/ui/icons/google-icon";
import { MicrosoftIcon } from "@integramind/ui/icons/microsoft-icon";

export function Socials() {
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
        <GithubIcon className="size-4 fill-white" />
        <span className="sr-only">Github Logo</span>
      </Button>
    </div>
  );
}
