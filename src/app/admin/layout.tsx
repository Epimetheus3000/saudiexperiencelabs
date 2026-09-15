import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_master) redirect("/");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← Back to labs
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/admin/labs" className="hover:underline">
              Labs
            </Link>
            <Link href="/admin/users" className="hover:underline">
              Users
            </Link>
            <Link href="/admin/criteria" className="hover:underline">
              Global criteria
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
