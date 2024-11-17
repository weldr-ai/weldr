"use client";

import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, buttonVariants } from "@integramind/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";
import { Input } from "@integramind/ui/input";
import { Label } from "@integramind/ui/label";
import { cn } from "@integramind/ui/utils";

import { GoogleIcon } from "@integramind/ui/icons/google-icon";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import { MicrosoftIcon } from "@integramind/ui/icons/microsoft-icon";
import { useTheme } from "next-themes";
import { signInWithMagicLink } from "~/lib/auth/actions";

export default function SignIn() {
  const { resolvedTheme } = useTheme();
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [_, formAction] = useActionState(signInWithMagicLink, undefined);

  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-hidden bg-transparent p-8 shadow-none md:border-solid md:bg-card md:shadow-sm">
        <CardHeader className="flex flex-col items-start justify-start">
          <CardTitle className="flex flex-col gap-4">
            <LogoIcon
              className="size-10"
              theme={resolvedTheme === "dark" ? "dark" : "light"}
            />
            <span className="text-xl">Sign up to integramind</span>
          </CardTitle>
          <CardDescription className="text-center">
            Welcome! Please fill in the details to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full" variant="outline" size="icon">
                <GoogleIcon className="size-4" />
                <span className="sr-only">Google Logo</span>
              </Button>
              <Button className="w-full" variant="outline" size="icon">
                <MicrosoftIcon className="size-4" />
                <span className="sr-only">Microsoft Logo</span>
              </Button>
            </div>
            <Link
              href="/sign-up/magic-auth"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Continue with email code
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground md:bg-card">
                OR
              </span>
            </div>
          </div>
          <form className="flex flex-col gap-4" action={formAction}>
            <div className="flex flex-col gap-4 md:flex-row md:gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="Your first name"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Your last name"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Your email address"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Password</Label>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1 size-7"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-3" />
                  ) : (
                    <EyeIcon className="size-3" />
                  )}
                </Button>
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  required
                />
              </div>
            </div>
            <Submit />
          </form>
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground md:flex-row md:gap-0">
            <div>
              Have an account?{" "}
              <Link
                href="/auth/sign-in"
                className="text-primary hover:underline"
              >
                Sign in
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="https://integramind.ai/contact-us"
                className="hover:underline"
              >
                Help
              </Link>
              <Link
                href="https://integramind.ai/privacy-policy"
                className="hover:underline"
              >
                Privacy
              </Link>
              <Link
                href="https://integramind.ai/terms-and-conditions"
                className="hover:underline"
              >
                Terms
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      className="text-xs"
      aria-disabled={pending}
      disabled={pending}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Continue
    </Button>
  );
}
