"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BellIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export function MainNav() {
  const { user, userData, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Check if current path is auth related
  const isAuthPath = pathname?.startsWith("/auth");

  // If user is logged in and trying to access auth pages, redirect to dashboard
  if (user && isAuthPath) {
    router.push("/dashboard");
    return null;
  }

  return (
    <header className="border-b">
      <div className="container flex items-center justify-between py-4">
        <Link href="/" className="text-2xl font-bold">
          MeetupMN
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/events">
            <Button variant="ghost">Эвентүүд</Button>
          </Link>

          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Хянах самбар</Button>
              </Link>
              <Link href="/messages">
                <Button variant="ghost" className="relative">
                  <MessageSquareIcon className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/notifications">
                <Button variant="ghost" className="relative">
                  <BellIcon className="h-5 w-5" />
                  {/* Notification badge would go here */}
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage
                      src={userData?.photoURL || undefined}
                      alt={userData?.displayName || "User"}
                    />
                    <AvatarFallback>
                      {userData?.displayName?.charAt(0) ||
                        user.email?.charAt(0) ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      {userData?.displayName && (
                        <p className="font-medium">{userData.displayName}</p>
                      )}
                      {user.email && (
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Хянах самбар</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/edit" className="cursor-pointer">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      <span>Профайл засах</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOutIcon className="mr-2 h-4 w-4" />
                    <span>Гарах</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost">Нэвтрэх</Button>
              </Link>
              <Link href="/auth/register">
                <Button>Бүртгүүлэх</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
