"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderIcon } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@weldr/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@weldr/ui/components/form";
import { Input } from "@weldr/ui/components/input";
import { toast } from "@weldr/ui/hooks/use-toast";

import { joinWaitlist } from "@/lib/actions/waitlist";

const insertWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export function JoinWaitlistForm({
  variant = "default",
}: {
  variant?: "default" | "secondary";
}) {
  const [state, joinWaitlistAction] = useActionState(joinWaitlist, undefined);
  const form = useForm<z.infer<typeof insertWaitlistSchema>>({
    resolver: zodResolver(insertWaitlistSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    async function handleStateUpdate() {
      if (state) {
        if (state.status === "validationError") {
          for (const key of Object.keys(state.errors)) {
            form.setError(key as "email", {
              message: state.errors[key],
            });
          }
          toast({
            title: "Validation Error",
            description: "Please enter a valid email address.",
            variant: "destructive",
            duration: 2000,
          });
        }

        if (state.status === "error") {
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
      <form
        action={joinWaitlistAction}
        className="flex w-full flex-col gap-2 md:relative md:w-96 md:gap-0"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="h-10 w-full rounded-full md:w-96"
                  placeholder="Enter your email"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <SubmitButton
          variant={variant}
          className="rounded-full md:absolute md:top-1 md:right-1 md:h-8"
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
      variant={variant}
    >
      {pending && <LoaderIcon className="mr-1 size-3 animate-spin" />}
      Join Waitlist
    </Button>
  );
}
