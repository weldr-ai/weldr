"use client";

import { useState } from "react";

import { authClient } from "@weldr/auth/client";
import { Button } from "@weldr/ui/components/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { GithubIcon, GoogleIcon, MicrosoftIcon } from "@weldr/ui/icons";
import { LoaderIcon } from "lucide-react";

export function Socials() {
  const [isSubmitting, setIsSubmitting] = useState<
    "github" | "microsoft" | "google" | null
  >(null);

  async function onSocialSignIn(provider: "github" | "microsoft" | "google") {
    await authClient.signIn.social({
      provider,
      callbackURL: "/",
      fetchOptions: {
        onResponse: () => {
          setIsSubmitting(null);
        },
        onRequest: () => {
          setIsSubmitting(provider);
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
        aria-disabled={isSubmitting !== null}
        disabled={isSubmitting !== null}
        onClick={() => onSocialSignIn("google")}
      >
        {isSubmitting === "google" ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <GoogleIcon className="size-4" />
        )}
        <span className="sr-only">Google Logo</span>
      </Button>
      <Button
        className="w-full"
        variant="outline"
        size="icon"
        aria-disabled={isSubmitting !== null}
        disabled={isSubmitting !== null}
        onClick={() => onSocialSignIn("microsoft")}
      >
        {isSubmitting === "microsoft" ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <MicrosoftIcon className="size-4" />
        )}
        <span className="sr-only">Microsoft Logo</span>
      </Button>
      <Button
        className="w-full"
        variant="outline"
        size="icon"
        aria-disabled={isSubmitting !== null}
        disabled={isSubmitting !== null}
        onClick={() => onSocialSignIn("github")}
      >
        {isSubmitting === "github" ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <GithubIcon className="size-4 fill-white" />
        )}
        <span className="sr-only">Github Logo</span>
      </Button>
    </div>
  );
}
