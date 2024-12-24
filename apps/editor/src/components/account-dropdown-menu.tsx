"use client";

import { authClient } from "@integramind/auth/client";
import { useAuth } from "@integramind/auth/provider";
import { Avatar, AvatarFallback, AvatarImage } from "@integramind/ui/avatar";
import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { useTheme } from "@integramind/ui/theme-provider";
import { LogOutIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export function AccountDropdownMenu() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-8">
          <Avatar className="size-8 rounded-md">
            <AvatarImage src={user?.image ?? undefined} alt="Avatar" />
            <AvatarFallback>
              <Image
                src={`${process.env.NEXT_PUBLIC_EDITOR_BASE_URL}/api/avatars/${user?.email}`}
                alt="Avatar"
                width={32}
                height={32}
              />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end" side="right">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Appearance</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup onValueChange={setTheme} value={theme}>
                <DropdownMenuRadioItem value="light">
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () =>
            await authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/auth/sign-in");
                },
              },
            })
          }
        >
          Sign out
          <LogOutIcon className="ml-auto size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
