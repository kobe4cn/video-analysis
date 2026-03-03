'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarNav } from '@/components/sidebar-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/hooks/use-auth';
import { ChangePasswordDialog } from '@/components/change-password-dialog';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) return null;

  return (
    <SidebarProvider>
      <SidebarNav />
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>视频解析平台</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback className="text-xs">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user.email} ({user.role})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPwdDialogOpen(true)}>修改密码</DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>退出登录</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
      <ChangePasswordDialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen} />
    </SidebarProvider>
  );
}
