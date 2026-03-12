import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import {
  Images,
  LayoutDashboard,
  LogOut,
  Shield,
  Upload,
  User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSite } from '../context/SiteContext'
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

export const Route = createFileRoute('/_user')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isLoading && !context.auth.user) {
      throw redirect({
        to: '/login',
      })
    }
  },
  component: UserLayout,
})

function UserLayout() {
  const { user, logout, isLoading } = useAuth()
  const { siteInfo } = useSite()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Images className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {siteInfo.site_name}
                    </span>
                    <span className="truncate text-xs">
                      欢迎, {user?.username}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <Separator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="概览">
                    <Link
                      to="/dashboard/overview"
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
                  <SidebarMenuButton asChild tooltip="上传图片">
                    <Link
                      to="/dashboard/upload"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <Upload />
                      <span>上传图片</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="我的画廊">
                    <Link
                      to="/dashboard/gallery"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <Images />
                      <span>我的画廊</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="个人资料">
                    <Link
                      to="/dashboard/profile"
                      activeProps={{
                        className:
                          'bg-sidebar-accent text-sidebar-accent-foreground',
                      }}
                    >
                      <User />
                      <span>个人资料</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {user?.admin && (
                  <>
                    <Separator className="my-2" />
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="管理后台">
                        <Link to="/admin/overview">
                          <Shield />
                          <span>管理后台</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={logout}
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
          <Separator orientation="vertical" className="mr-2 h-4" />
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
