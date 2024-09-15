"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { signInWithMagicLinkSchema } from "@specly/auth/validators";
import { Button } from "@specly/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@specly/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@specly/ui/form";
import { Input } from "@specly/ui/input";
import { toast } from "@specly/ui/use-toast";

import { GoogleIcon } from "@specly/ui/icons/google-icon";
import { MicrosoftIcon } from "@specly/ui/icons/microsoft-icon";
import { SpeclyIcon } from "@specly/ui/icons/specly-icon";
import { useTheme } from "next-themes";
import { signInWithMagicLink } from "~/lib/auth/actions";

export default function SignIn() {
  const { resolvedTheme } = useTheme();

  const [state, signInWithMagicLinkAction] = useFormState(
    signInWithMagicLink,
    undefined,
  );

  const form = useForm<z.infer<typeof signInWithMagicLinkSchema>>({
    mode: "onChange",
    resolver: zodResolver(signInWithMagicLinkSchema),
    defaultValues: {
      email: "",
      ...(state &&
        (state.status === "error" || state.status === "validationError") &&
        state.fields),
    },
  });

  useEffect(() => {
    if (state) {
      if (state.status === "validationError") {
        for (const key of Object.keys(state.errors) as Array<
          keyof typeof state.errors
        >) {
          form.setError(key, {
            message: state.errors[key],
          });
        }
        toast({
          title: "Validation Error",
          description: "Please enter fields correctly.",
          variant: "destructive",
          duration: 2000,
        });
      } else if (state.status === "error") {
        toast({
          title: "Error",
          description: "Something went wrong.",
          variant: "destructive",
          duration: 2000,
        });
      }
    }
  }, [form, state]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <Card className="mx-auto w-full max-w-md border-hidden bg-transparent p-8 shadow-none md:border-solid md:bg-card md:shadow-sm">
        <CardHeader className="flex flex-col items-start justify-start">
          <CardTitle className="flex flex-col gap-4">
            <SpeclyIcon
              className="size-10"
              theme={resolvedTheme as "light" | "dark"}
            />
            <span className="text-xl">Sign in to specly</span>
          </CardTitle>
          <CardDescription className="text-center">
            Welcome back! Please sign in to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Button className="w-full" variant="outline" size="icon">
              <GoogleIcon className="size-4" />
              <span className="sr-only">Google Logo</span>
            </Button>
            <Button className="w-full" variant="outline" size="icon">
              <MicrosoftIcon className="size-4" />
              <span className="sr-only">Microsoft Logo</span>
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
          </div>
          <Form {...form}>
            <form
              action={signInWithMagicLinkAction}
              className="flex w-full flex-col space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Enter your email"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SubmitButton formState={form.formState} />
            </form>
          </Form>
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground md:flex-row md:gap-0">
            <div>
              No account?{" "}
              <Link
                href="/auth/sign-up"
                className="text-primary hover:underline"
              >
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
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function SubmitButton({
  formState,
}: {
  formState: FormState<z.infer<typeof signInWithMagicLinkSchema>>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={!formState.isValid || pending}
      disabled={!formState.isValid || pending}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Continue
    </Button>
  );
}
