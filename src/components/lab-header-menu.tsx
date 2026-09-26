"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu as MenuIcon, Download, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Consolidates the lab header's per-page actions (export, admin settings,
// sign out) into one menu — they used to be separate scattered links/buttons.
export function LabHeaderMenu({ labId, isMaster }: { labId: string; isMaster: boolean }) {
  const signOutFormRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={signOutFormRef} action="/auth/signout" method="post" className="hidden" />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Menu" />}>
          <MenuIcon className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLinkItem href={`/labs/${labId}/export`} closeOnClick>
            <Download className="size-4" />
            Export to Excel
          </DropdownMenuLinkItem>
          {isMaster && (
            <DropdownMenuLinkItem
              href={`/admin/labs/${labId}`}
              closeOnClick
              render={<Link href={`/admin/labs/${labId}`} />}
            >
              <Settings className="size-4" />
              Lab settings
            </DropdownMenuLinkItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => signOutFormRef.current?.submit()}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
