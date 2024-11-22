"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { authClient } from "@integramind/auth/client";
import { resetPasswordSchema } from "@integramind/shared/validators/auth";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    mode: "onChange",
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: z.infer<typeof resetPasswordSchema>) {
    await authClient.resetPassword({
      newPassword: data.password,
      fetchOptions: {
        onResponse: () => {
          setIsSubmitting(false);
        },
        onRequest: () => {
          setIsSubmitting(true);
        },
        onError: (ctx) => {
          toast({
            title: "Failed to reset password",
            description: ctx.error?.message,
            variant: "destructive",
          });
        },
        onSuccess: () => {
          router.push("/auth/sign-in");
        },
      },
    });
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center">
      <Card className="mx-auto w-full max-w-lg border-hidden bg-transparent p-8 shadow-none md:border-solid md:bg-card md:shadow-sm">
        <CardHeader className="flex flex-col items-start justify-start">
          <CardTitle className="flex flex-col gap-4">
            <LogoIcon className="size-10" />
            <span className="text-xl">Create new password</span>
          </CardTitle>
          <CardDescription>
            Please enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="Enter new password"
                          required
                          type={showPassword ? "text" : "password"}
                        />
                        <Button
                          className="absolute right-1 top-1 size-7"
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOffIcon className="size-3" />
                          ) : (
                            <EyeIcon className="size-3" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="Confirm new password"
                          required
                          type={showConfirmPassword ? "text" : "password"}
                        />
                        <Button
                          className="absolute right-1 top-1 size-7"
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOffIcon className="size-3" />
                          ) : (
                            <EyeIcon className="size-3" />
                          )}
                        </Button>
                      </div>
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
                Reset password
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
