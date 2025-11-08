"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import ThemeSwitcher from "../ThemeSwitcher";
import { Home } from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // Set to false for testing

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const isNearTop = e.clientY < 10;
      const isInNavbar = e.clientY < 60; // Navbar height approx 60px
      setIsVisible((prev) => isNearTop || (prev && isInNavbar));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 导航链接列表，便于维护
  const navLinks = [
    { href: "/", label: "RAG检索增强" },
    { href: "/quiz", label: "刷题" },
    { href: "/analysis", label: "分析中心" },
    { href: "/fsrs/manage", label: "FSRS间歇重复" },
    { href: "/profile", label: "个人中心" },
    { href: "/tool/case-ocr", label: "case-OCR" },
    // 可以添加更多链接
  ];

  return (
    <>
      <nav
        className={`fixed inset-x-0 bg-background/75 backdrop-blur-sm border-b shadow-sm z-50 transition-transform duration-300 ease-in-out ${isVisible ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex justify-between items-center h-8">
            <div className="flex items-center space-x-4">
              <Link
                href="/wiki"
                className="text-2xl font-bold text-foreground hover:text-primary transition-colors"
              >
                <Home />
              </Link>
              {/* 桌面端导航链接 */}
              <div className="hidden md:flex items-center space-x-4 pl-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* 用户登录状态区域 */}
            <div className="flex items-center space-x-2">
              {/* 移动端菜单按钮 */}
              <div className="md:hidden mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </Button>
              </div>

              {loading ? (
                <Button variant="ghost" disabled className="text-sm">
                  加载中...
                </Button>
              ) : session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full p-0"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={
                            session.user?.avatar ? `${session.user.avatar}` : ""
                          }
                          alt={session.user?.name || "User"}
                        />
                        <AvatarFallback className="w-full">
                          {session.user?.name?.charAt(0) ||
                            session.user?.email?.charAt(0) ||
                            "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 bg-background text-foreground border border-border"
                  >
                    <div className="flex items-center gap-2 p-3 bg-popover text-popover-foreground">
                      <div className="flex flex-col">
                        {session.user?.name && (
                          <span className="font-semibold">
                            {session.user.name}
                          </span>
                        )}
                        {session.user?.email && (
                          <span className="text-sm text-muted-foreground truncate">
                            {session.user.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      asChild
                      className="hover:bg-accent hover:text-accent-foreground"
                    >
                      <Link href="/profile" className="w-full">
                        个人资料
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive-foreground hover:bg-destructive/90"
                      onSelect={(e) => {
                        e.preventDefault();
                        signOut({ callbackUrl: "/" });
                      }}
                    >
                      退出登录
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center space-x-2">
                  <Button variant="outline" asChild>
                    <Link href="/auth/signin" className="text-sm">
                      登录
                    </Link>
                  </Button>
                  <Button asChild className="text-sm">
                    <Link href="/auth/signup">注册</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background/95 border-t shadow-md">
            <div className="px-4 pt-4 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-3 py-2 rounded-md text-base font-medium text-foreground/80 hover:bg-muted hover:text-primary transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      {/* 移动端展开按钮 - 标签样式 */}
      {!isVisible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 md:hidden z-50">
          <div
            className="bg-primary/10 backdrop-blur-sm px-3 py-1 rounded-full border border-primary/20 shadow-sm flex items-center gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={() => {
              setIsVisible(true);
              setMobileMenuOpen(true);
            }}
          >
            <Menu size={16} className="text-primary" />
            <span className="text-xs font-medium text-primary">菜单</span>
          </div>
        </div>
      )}
    </>
  );
}
