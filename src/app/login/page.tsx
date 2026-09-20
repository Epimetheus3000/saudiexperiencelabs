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
    // The magic link's destination is set in the Supabase "Magic Link" email
    // template (/auth/confirm?token_hash=...&type=magiclink), not here — see
    // PROJECT_NOTES.md for why this uses verifyOtp instead of the PKCE
    // exchangeCodeForSession flow.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <Image
        src="/brand/login-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Scrim for card legibility against the photo, independent of screen size. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent"
        aria-hidden
      />
      <Card className="relative w-full max-w-sm shadow-xl">
        <CardHeader className="items-center text-center">
          <Image
            src="/brand/saudi-experience-labs-logo.png"
            alt="Saudi Experience Labs"
            width={747}
            height={243}
            className="mb-2 h-16 w-auto"
            priority
          />
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
