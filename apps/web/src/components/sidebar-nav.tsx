'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  ListTodo,
  Sparkles,
  Settings,
  Users,
  Database,
  Bot,
  Link2,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/auth-store';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole: 'USER' | 'OPERATOR' | 'ADMIN';
}

const mainNav: NavItem[] = [
  { title: '仪表盘', href: '/dashboard', icon: LayoutDashboard, minRole: 'USER' },
  { title: '视频管理', href: '/dashboard/videos', icon: Video, minRole: 'USER' },
  { title: '链接视频', href: '/dashboard/link-videos', icon: Link2, minRole: 'OPERATOR' },
  { title: '解析任务', href: '/dashboard/tasks', icon: ListTodo, minRole: 'OPERATOR' },
  { title: 'Skills 管理', href: '/dashboard/skills', icon: Sparkles, minRole: 'OPERATOR' },
];

const settingsNav: NavItem[] = [
  { title: '模型管理', href: '/dashboard/settings/models', icon: Bot, minRole: 'ADMIN' },
  { title: '存储管理', href: '/dashboard/settings/storage', icon: Database, minRole: 'ADMIN' },
  { title: '用户管理', href: '/dashboard/settings/users', icon: Users, minRole: 'ADMIN' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const hasRole = useAuthStore((s) => s.hasRole);

  const filteredMain = mainNav.filter((item) => hasRole(item.minRole));
  const filteredSettings = settingsNav.filter((item) => hasRole(item.minRole));

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    }
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredSettings.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <Settings className="mr-2 h-4 w-4 inline" />
              设置
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredSettings.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
