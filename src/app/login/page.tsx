"use client";

import { useState } from "react";
import Image from "next/image";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  }

  return (
    // The Grid visual property, full-bleed — this is the one screen where a
    // bigger brand moment is appropriate; every other screen sticks to
    // Minimal/Strip only, per the brand rule against mixing property styles.
    <div className="pattern-grid-bg flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="items-center text-center">
          <Image
            src="/brand/visit-saudi-logo.png"
            alt="Visit Saudi — Welcome to Arabia"
            width={241}
            height={134}
            className="mb-2 h-16 w-auto"
            priority
          />
          <CardTitle>Experience Labs</CardTitle>
          <CardDescription>
            {sent
              ? "Check your inbox for a sign-in link."
              : "Sign in with a magic link sent to your email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending link…" : "Send magic link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
