import { Link, useLocation } from "wouter";
import {
  Gift,
  Send,
  Target,
  Rss,
  Inbox,
  Workflow,
  BarChart3,
  Home,
  Sparkles,
  Settings,
  Layers,
  LogOut,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

// Core navigation - Correct product flow
const mainNavItems = [
  { title: "Start Here", url: "/start-here", icon: Home },
  { title: "Topics", url: "/topics", icon: Target },
  { title: "Pipeline", url: "/pipeline", icon: Workflow },
  { title: "Publishing", url: "/publishing", icon: Send },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

// Admin tools - operational necessities only
const getAdminNavItems = (isSiteAdmin: boolean) => {
  const items = [
    { title: "Inbox", url: "/inbox", icon: Inbox },
    { title: "Settings", url: "/settings", icon: Settings },
  ];
  
  // Only show Sources for site admins
  if (isSiteAdmin) {
    items.unshift({ title: "Sources", url: "/sources", icon: Rss });
  }
  
  return items;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const isSiteAdmin = user?.isSiteAdmin === "true";
  const adminNavItems = getAdminNavItems(isSiteAdmin);

  return (
    <Sidebar className="border-r border-sidebar-border/50 bg-sidebar/80 backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/50">
      <SidebarHeader className="border-b border-sidebar-border/50 p-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground shadow-lg shadow-primary/20 transition-transform group-hover:scale-105 group-hover:rotate-3">
            <Gift className="h-5 w-5" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-300 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 group-hover:to-primary transition-all">
              Content Santa
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Magical Engine
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map((item) => {
                const isActive = location === item.url ||
                  (item.url !== "/" && location.startsWith(item.url));

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        relative gap-3 py-5 px-3 rounded-lg transition-all duration-200
                        ${isActive
                          ? "bg-primary/10 text-primary shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)] font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                        }
                      `}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        {isActive && (
                          <motion.div
                            layoutId="active-nav"
                            className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          />
                        )}
                        <item.icon className={`h-5 w-5 z-10 ${isActive ? "text-primary animate-pulse" : ""}`} />
                        <span className="z-10">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {adminNavItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        relative gap-3 py-2 px-3 rounded-lg transition-all duration-200
                        ${isActive
                          ? "bg-primary/5 text-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                        }
                      `}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-4 space-y-3">
        {/* User Profile Section */}
        <div className="relative overflow-hidden rounded-xl border border-sidebar-border/50 bg-sidebar-accent/20 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 text-xs font-bold text-white shadow-md">
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email?.split('@')[0] || "User"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {user?.email}
              </div>
              {isSiteAdmin && (
                <div className="text-[9px] uppercase tracking-wide text-purple-500 font-semibold mt-0.5">
                  Site Admin
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:border-destructive/50"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
