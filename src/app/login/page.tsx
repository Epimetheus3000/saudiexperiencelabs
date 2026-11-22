"use client";

import { useEffect, useState } from "react";
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

const LINK_FAILED_MESSAGE =
  "That link expired or was opened in a different browser. Request a new one or use the code.";

export default function LoginPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));

    // Invite emails (and any link Supabase verifies itself) redirect back
    // with the session in the URL fragment (#access_token=...), which the
    // server never sees — so the visitor lands here signed-out. Pick the
    // session up from the fragment and finish signing them in.
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const supabase = createClient();
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          window.history.replaceState(null, "", url.pathname);
          if (error) {
            setNotice(LINK_FAILED_MESSAGE);
            return;
          }
          window.location.replace("/");
        });
      return;
    }

    // A failed link: either our own /auth/callback (?error=link) or
    // Supabase's verify endpoint (#error=... / ?error=...).
    // (The URL fragment only exists in the browser, so this can't be read
    // during server render; set it just after mount instead.)
    if (url.searchParams.get("error") || hash.get("error")) {
      window.history.replaceState(null, "", url.pathname);
      queueMicrotask(() => setNotice(LINK_FAILED_MESSAGE));
    }
  }, []);

  async function onSubmit(values: FormValues) {
    // The magic link's destination is set in the Supabase "Magic Link" email
    // template (/auth/confirm?token_hash=...&type=magiclink), not here — see
    // PROJECT_NOTES.md for why this uses verifyOtp instead of the PKCE
    // exchangeCodeForSession flow. The same email also carries a one-time
    // code ({{ .Token }}) that can be typed in below, in any browser.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setNotice(null);
    setCode("");
    setSentTo(values.email);
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) {
      toast.error("Enter the code from the email.");
      return;
    }
    setVerifying(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token, type: "email" });
    if (error) {
      setVerifying(false);
      toast.error("That code is wrong or has expired. Check the latest email or request a new one.");
      return;
    }
    window.location.replace("/");
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
            {sentTo
              ? `We emailed ${sentTo}. Enter the code from the email, or click the link in it.`
              : "Sign in with a code or link sent to your email."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {notice}
            </p>
          )}
          {!sentTo ? (
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
                {isSubmitting ? "Sending…" : "Email me a sign-in code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={onVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Code from the email"
                  maxLength={12}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifying}>
                {verifying ? "Signing in…" : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setSentTo(null)}
              >
                Use a different email or send a new code
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
