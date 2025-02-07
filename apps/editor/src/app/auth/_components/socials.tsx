"use client";

import { useState } from "react";

import { authClient } from "@weldr/auth/client";
import { Button } from "@weldr/ui/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { GithubIcon } from "@weldr/ui/icons/github-icon";
import { GoogleIcon } from "@weldr/ui/icons/google-icon";
import { MicrosoftIcon } from "@weldr/ui/icons/microsoft-icon";

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
