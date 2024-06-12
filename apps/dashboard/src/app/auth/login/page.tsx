"use client";

import type { z } from "zod";
import Image from "next/image";
import { Loader2Icon } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@integramind/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";
import { Input } from "@integramind/ui/input";
import { Label } from "@integramind/ui/label";

import { signInWithMagicLink } from "~/lib/auth/actions";

export default function Login() {
  // const [showPassword, setShowPassword] = useState<boolean>(false);
  const [state, formAction] = useFormState(signInWithMagicLink, {
    errors: [],
  });

  const emailErrors = findErrors("email", state.errors);
  // const passwordErrors = findErrors("password", state.errors);

  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-hidden bg-transparent p-8 shadow-none md:border-solid md:bg-card md:shadow-sm">
        <CardHeader className="flex flex-col items-start justify-start">
          <CardTitle className="flex flex-col gap-4">
            <Image
              alt="IntegraMind"
              height={40}
              priority
              src="/logo.svg"
              width={40}
            />
            <span className="text-xl">Sign in to IntegraMind</span>
          </CardTitle>
          <CardDescription className="text-center">
            Welcome back! Please sign in to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* <div className="grid grid-cols-2 gap-4">
            <Button className="w-full" variant="outline" size="icon">
              <Image
                alt="Google"
                height={16}
                priority
                src="/logos/google.svg"
                width={16}
              />
            </Button>
            <Button className="w-full" variant="outline" size="icon">
              <Image
                alt="Microsoft"
                height={16}
                priority
                src="/logos/microsoft.svg"
                width={16}
              />
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground md:bg-card">
                OR
              </span>
            </div>
          </div> */}
          <form className="space-y-2" action={formAction}>
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                name="email"
                placeholder="Your email address"
                type="email"
                required
              />
              {emailErrors && (
                <ul className="list-inside list-disc">
                  {emailErrors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
            <Submit />
          </form>
          {/* <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground md:flex-row md:gap-0">
            <div>
              No account?{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="#" className="hover:underline">
                Help
              </Link>
              <Link href="#" className="hover:underline">
                Privacy
              </Link>
              <Link href="#" className="hover:underline">
                Terms
              </Link>
            </div>
          </div> */}
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
      className="flex w-full text-xs"
      aria-disabled={pending}
      disabled={pending}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Continue
    </Button>
  );
}

const findErrors = (fieldName: string, errors: z.ZodIssue[]) =>
  errors
    .filter((item) => {
      return item.path.includes(fieldName);
    })
    .map((item) => item.message);
