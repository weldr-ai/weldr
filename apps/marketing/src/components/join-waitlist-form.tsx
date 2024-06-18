"use client";

import type { z } from "zod";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";

import { insertWaitlistSchema } from "@integramind/db/schema";
import { Button } from "@integramind/ui/button";
import { Form, FormControl, FormField, FormItem } from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import { toast } from "@integramind/ui/use-toast";

import { joinWaitlist } from "~/lib/queries/waitlist";

export function JoinWaitlistForm({
  variant = "default",
}: {
  variant?: "default" | "secondary";
}) {
  const [state, joinWaitlistAction] = useFormState(joinWaitlist, undefined);
  const form = useForm<z.infer<typeof insertWaitlistSchema>>({
    resolver: zodResolver(insertWaitlistSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    async function handleStateUpdate() {
      if (state) {
        if (state.status === "success") {
          form.reset();
          toast({
            title: "Success",
            description:
              "Thank you for your interest! We will get in touch with you soon.",
            duration: 2000,
          });
        } else if (state.status === "validationError") {
          Object.keys(state.errors).forEach((key) => {
            form.setError(key as "email", {
              message: state.errors[key],
            });
          });
          toast({
            title: "Validation Error",
            description: "Please enter a valid email address.",
            variant: "destructive",
            duration: 2000,
          });
        } else {
          toast({
            title: "Error",
            description: "Something went wrong.",
            variant: "destructive",
            duration: 2000,
          });
        }
      }
    }
    void handleStateUpdate();
  }, [form, state]);

  return (
    <Form {...form}>
      <form action={joinWaitlistAction} className="relative">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="h-10 w-96 rounded-full"
                  placeholder="Enter your email"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <SubmitButton
          variant={variant}
          className="absolute right-1 top-1 rounded-full"
        />
      </form>
    </Form>
  );
}

function SubmitButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={pending}
      disabled={pending}
      className={className}
      size="sm"
      variant={variant}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Join Waitlist
    </Button>
  );
}
