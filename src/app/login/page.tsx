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
    <div className="flex flex-1 flex-col lg:min-h-screen lg:flex-row">
      {/* Image half: real Saudi hospitality photography, with a Strip
          pattern accent band tying it to the brand's visual system. The
          Grid property (below) stays the login screen's other property, per
          the brand rule against mixing more than two on one screen. */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden lg:h-auto lg:w-1/2">
        <Image
          src="/brand/login-photo.jpg"
          alt="Guests enjoying traditional Saudi hospitality"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[var(--brand-purple-dark)]/60 via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="pattern-strip absolute inset-x-0 bottom-0 h-5"
          style={{ "--strip-color": "var(--brand-purple-vibrant)" } as React.CSSProperties}
          aria-hidden
        />
      </div>

      {/* Form half: the Grid visual property, per the brand rule reserving
          it for this one "bigger brand moment" screen. */}
      <div className="pattern-grid-bg flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm shadow-xl">
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
    </div>
  );
}
