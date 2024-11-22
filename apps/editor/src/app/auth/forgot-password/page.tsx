"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { authClient } from "@integramind/auth/client";
import { forgotPasswordSchema } from "@integramind/shared/validators/auth";
import { Button } from "@integramind/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@integramind/ui/form";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import { Input } from "@integramind/ui/input";
import { toast } from "@integramind/ui/use-toast";
import { useRouter } from "next/navigation";
import { SupportLinks } from "../_components/support-links";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    mode: "onChange",
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: z.infer<typeof forgotPasswordSchema>) {
    await authClient.forgetPassword({
      email: data.email,
      redirectTo: "/auth/reset-password",
      fetchOptions: {
        onResponse: () => {
          setIsSubmitting(false);
        },
        onRequest: () => {
          setIsSubmitting(true);
        },
        onError: (ctx) => {
          toast({
            title: "Failed to send reset link",
            description: ctx.error?.message,
            variant: "destructive",
          });
        },
      },
    });

    router.push("/auth/forgot-password/confirm");
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <Card className="mx-auto w-full max-w-lg border-hidden bg-transparent p-8 shadow-none md:border-solid md:bg-card md:shadow-sm">
        <CardHeader className="flex flex-col items-start justify-start">
          <CardTitle className="flex flex-col gap-4">
            <LogoIcon className="size-10" />
            <span className="text-xl">Reset your password</span>
          </CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your email"
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                className="w-full"
                type="submit"
                aria-disabled={!form.formState.isValid || isSubmitting}
                disabled={!form.formState.isValid || isSubmitting}
              >
                {isSubmitting && (
                  <Loader2Icon className="mr-1 size-3 animate-spin" />
                )}
                Send reset link
              </Button>
            </form>
          </Form>
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground md:flex-row md:gap-0">
            <div>
              Remember your password?{" "}
              <Link
                href="/auth/sign-in"
                className="text-primary hover:underline"
              >
                Sign in
              </Link>
            </div>
            <SupportLinks />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
