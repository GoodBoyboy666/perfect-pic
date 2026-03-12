import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowLeft,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Separator } from '../components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '../components/ui/sidebar'

export const Route = createFileRoute('/_admin')({
  beforeLoad: ({ context }) => {
    if (
      !context.auth.isLoading &&
      (!context.auth.user || !context.auth.user.admin)
    ) {
      throw redirect({
        to: '/login', // Or a 403 page
      })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { logout, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        Loading...
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Settings className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">管理后台</span>
              <span className="truncate text-xs">Admin Panel</span>
            </div>
          </div>
        </SidebarHeader>
        <Separator className="bg-sidebar-border" />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="概览">
                    <Link
                      to="/admin/overview"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <LayoutDashboard />
                      <span>概览</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="用户管理">
                    <Link
                      to="/admin/users"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <Users />
                      <span>用户管理</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="图片管理">
                    <Link
                      to="/admin/images"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <ImageIcon />
                      <span>图片管理</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="系统设置">
                    <Link
                      to="/admin/settings"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <Settings />
                      <span>系统设置</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="返回用户面板">
                    <Link to="/dashboard/overview">
                      <ArrowLeft />
                      <span>返回用户面板</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={logout}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                tooltip="退出登录"
              >
                <LogOut />
                <span>退出登录</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="absolute left-4 top-4 z-50">
          <SidebarTrigger />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-14 bg-background">
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-4">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
