"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

export function AppShellBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) {
    return null;
  }

  return (
    <div className="relative bg-background">
      <div className="flex items-center px-6 py-3">
        {/* Real "Welcome to Arabia" stacked lockup, reproduced unaltered from
            the comprehensive guidelines. Minimum on-screen width per the
            guidelines' exclusion-zone/minimum-size rule is 90px — sized well
            above that here, with generous clear space around it. */}
        <Image
          src="/brand/visit-saudi-logo.png"
          alt="Visit Saudi — Welcome to Arabia"
          width={241}
          height={134}
          className="h-11 w-auto"
          priority
        />
        <span className="ml-4 border-l pl-4 text-sm text-muted-foreground">
          Experience Labs
        </span>
      </div>
      <div className="pattern-strip-minimal h-1.5 w-full" aria-hidden />
    </div>
  );
}
