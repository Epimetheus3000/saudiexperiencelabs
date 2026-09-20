"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

// Requires an explicit click before calling verifyOtp, rather than verifying
// as soon as this page loads. Corporate email security gateways commonly
// pre-fetch links in inbound mail to scan them; a link that verifies itself
// on page load gets its one-time token consumed by that scan before the
// person ever clicks it. A scan won't click a button.
function ConfirmCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  async function handleContinue() {
    if (!tokenHash || !type) return;
    setStatus("verifying");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    router.push(next);
  }

  const linkIncomplete = !tokenHash || !type;

  return (
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
          {linkIncomplete
            ? "This sign-in link is incomplete. Request a new one."
            : status === "error"
              ? errorMessage
              : "Click below to finish signing in."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linkIncomplete || status === "error" ? (
          <Button className="w-full" render={<Link href="/login" />}>
            Back to sign in
          </Button>
        ) : (
          <Button className="w-full" onClick={handleContinue} disabled={status === "verifying"}>
            {status === "verifying" ? "Signing in…" : "Continue to Saudi Experience Labs"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuthConfirmPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense fallback={null}>
        <ConfirmCard />
      </Suspense>
    </div>
  );
}
