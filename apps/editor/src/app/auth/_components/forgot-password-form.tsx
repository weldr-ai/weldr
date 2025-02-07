"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { authClient } from "@weldr/auth/client";
import { forgotPasswordSchema } from "@weldr/shared/validators/auth";
import { Button } from "@weldr/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@weldr/ui/form";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import { Input } from "@weldr/ui/input";
import { useRouter } from "next/navigation";
import { SupportLinks } from "../_components/support-links";

export function ForgotPasswordForm() {
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
          <div className="flex flex-col items-center justify-between gap-2 text-muted-foreground text-xs md:flex-row md:gap-0">
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
