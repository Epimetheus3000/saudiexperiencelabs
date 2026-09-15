import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Sign-in link expired or invalid</h1>
      <p className="text-muted-foreground max-w-sm">
        Magic links only work once and expire quickly. Request a new one to sign in.
      </p>
      <Button render={<Link href="/login" />}>Back to sign in</Button>
    </div>
  );
}
