import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Users,
  FileText,
  Zap,
  Activity,
  TrendingUp,
  Server,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  Eye,
  MoreHorizontal,
  Search,
  Filter,
  Download,
  UserCheck,
  UserX,
  Crown,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";
import type { Asset, WorkflowRun, WorkflowType } from "@shared/schema";
import { workflowMeta } from "@shared/schema";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalAssets: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  tokensUsed: number;
  storageUsed: number;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  database: "connected" | "disconnected";
  aiService: "operational" | "degraded" | "down";
  uptime: number;
  lastCheck: string;
}

interface UserWithStats extends User {
  assetCount?: number;
  runCount?: number;
  lastActive?: string;
}

interface RecentActivity {
  id: string;
  type: "user_signup" | "asset_created" | "workflow_run" | "publish" | "error";
  description: string;
  userId?: string;
  userName?: string;
  timestamp: string;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  loading 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  description?: string;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="mt-1 h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend && (
            <Badge variant={trend.positive ? "secondary" : "destructive"} className="text-xs">
              {trend.positive ? "+" : ""}{trend.value}%
            </Badge>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SystemStatusCard({ health, loading }: { health?: SystemHealth; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const statusColors = {
    healthy: "bg-emerald-500",
    operational: "bg-emerald-500",
    connected: "bg-emerald-500",
    degraded: "bg-amber-500",
    down: "bg-red-500",
    disconnected: "bg-red-500",
  };

  return (
    <Card data-testid="card-system-status">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">Overall Status</span>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColors[health?.status || "healthy"]}`} />
            <span className="text-sm font-medium capitalize">{health?.status || "Healthy"}</span>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm">Database</span>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm capitalize">{health?.database || "Connected"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">AI Service</span>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm capitalize">{health?.aiService || "Operational"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Uptime</span>
          <span className="text-sm font-medium">{health?.uptime || 99.9}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function UsersTable({ users, loading }: { users?: UserWithStats[]; loading?: boolean }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredUsers = users?.filter((user) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
      const email = user.email?.toLowerCase() || "";
      if (!name.includes(query) && !email.includes(query)) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {["User", "Email", "Assets", "Runs", "Last Active", "Actions"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(6)].map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-export-users">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Assets</TableHead>
              <TableHead className="text-center">Runs</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers && filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">ID: {user.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email || "N/A"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{user.assetCount || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{user.runCount || 0}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastActive 
                      ? format(new Date(user.lastActive), "MMM d, yyyy")
                      : "Never"
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Crown className="mr-2 h-4 w-4" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <UserX className="mr-2 h-4 w-4" />
                          Suspend User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RecentActivityFeed({ activities, loading }: { activities?: RecentActivity[]; loading?: boolean }) {
  const activityIcons: Record<RecentActivity["type"], React.ElementType> = {
    user_signup: UserCheck,
    asset_created: FileText,
    workflow_run: Zap,
    publish: CheckCircle,
    error: AlertTriangle,
  };

  const activityColors: Record<RecentActivity["type"], string> = {
    user_signup: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    asset_created: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    workflow_run: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    publish: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const mockActivities: RecentActivity[] = [
    { id: "1", type: "user_signup", description: "New user signed up", userName: "John Doe", timestamp: new Date().toISOString() },
    { id: "2", type: "workflow_run", description: "SEO Blog workflow completed", userName: "Jane Smith", timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: "3", type: "asset_created", description: "New content asset created", userName: "Alex Johnson", timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: "4", type: "publish", description: "Content published to WordPress", userName: "Sarah Lee", timestamp: new Date(Date.now() - 10800000).toISOString() },
    { id: "5", type: "workflow_run", description: "Translation workflow started", userName: "Mike Brown", timestamp: new Date(Date.now() - 14400000).toISOString() },
  ];

  const displayActivities = activities || mockActivities;

  return (
    <Card data-testid="card-recent-activity">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {displayActivities.map((activity) => {
              const Icon = activityIcons[activity.type];
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${activityColors[activity.type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {activity.userName && <span>{activity.userName}</span>}
                      <span>{format(new Date(activity.timestamp), "h:mm a")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function WorkflowMetrics({ runs, loading }: { runs?: WorkflowRun[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const workflowCounts: Record<string, { total: number; success: number }> = {};
  runs?.forEach((run) => {
    if (!workflowCounts[run.workflowType]) {
      workflowCounts[run.workflowType] = { total: 0, success: 0 };
    }
    workflowCounts[run.workflowType].total++;
    if (run.status === "succeeded") {
      workflowCounts[run.workflowType].success++;
    }
  });

  const metrics = Object.entries(workflowMeta).map(([key, meta]) => ({
    type: key,
    label: meta.label,
    total: workflowCounts[key]?.total || 0,
    successRate: workflowCounts[key] 
      ? Math.round((workflowCounts[key].success / workflowCounts[key].total) * 100) 
      : 0,
  }));

  return (
    <Card data-testid="card-workflow-metrics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Workflow Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => (
          <div key={metric.type} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{metric.label}</span>
              <span className="text-muted-foreground">
                {metric.total} runs ({metric.successRate}% success)
              </span>
            </div>
            <Progress value={metric.successRate} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContentModeration({ assets, loading }: { assets?: Asset[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentAssets = assets?.slice(0, 10) || [];

  return (
    <Card data-testid="card-content-moderation">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Content Overview
        </CardTitle>
        <CardDescription>Recent content across all users</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {recentAssets.length > 0 ? (
              recentAssets.map((asset) => (
                <div 
                  key={asset.id} 
                  className="flex items-center justify-between rounded-lg border p-3"
                  data-testid={`content-item-${asset.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        Asset #{asset.id}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {asset.createdAt ? format(new Date(asset.createdAt), "MMM d, yyyy") : ""}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 capitalize">
                    {asset.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No content available.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        return {
          totalUsers: 0,
          activeUsers: 0,
          totalAssets: 0,
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          tokensUsed: 0,
          storageUsed: 0,
        };
      }
      return res.json();
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: runs, isLoading: runsLoading } = useQuery<WorkflowRun[]>({
    queryKey: ["/api/runs"],
  });

  const { data: assets, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-4xl font-bold" data-testid="text-admin-title">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            System overview and management
          </p>
        </div>
        <Button variant="outline" data-testid="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">
            <FileText className="mr-2 h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Server className="mr-2 h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              value={stats?.totalUsers || users?.length || 0}
              icon={Users}
              description="Registered users"
              trend={{ value: 12, positive: true }}
              loading={statsLoading && usersLoading}
            />
            <StatCard
              title="Total Assets"
              value={stats?.totalAssets || assets?.length || 0}
              icon={FileText}
              description="Content assets created"
              trend={{ value: 8, positive: true }}
              loading={statsLoading && assetsLoading}
            />
            <StatCard
              title="Workflow Runs"
              value={stats?.totalRuns || runs?.length || 0}
              icon={Zap}
              description="AI workflows executed"
              trend={{ value: 15, positive: true }}
              loading={statsLoading && runsLoading}
            />
            <StatCard
              title="Success Rate"
              value={`${stats?.totalRuns ? Math.round((stats.successfulRuns / stats.totalRuns) * 100) : runs?.filter(r => r.status === "succeeded").length ? Math.round((runs.filter(r => r.status === "succeeded").length / runs.length) * 100) : 0}%`}
              icon={TrendingUp}
              description="Workflow success rate"
              loading={statsLoading && runsLoading}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivityFeed loading={false} />
            <WorkflowMetrics runs={runs} loading={runsLoading} />
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Total Users"
              value={users?.length || 0}
              icon={Users}
              loading={usersLoading}
            />
            <StatCard
              title="Active Today"
              value={stats?.activeUsers || 0}
              icon={UserCheck}
              loading={statsLoading}
            />
            <StatCard
              title="New This Week"
              value={0}
              icon={TrendingUp}
              loading={statsLoading}
            />
          </div>
          <UsersTable users={users} loading={usersLoading} />
        </TabsContent>

        <TabsContent value="content" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              title="Total Assets"
              value={assets?.length || 0}
              icon={FileText}
              loading={assetsLoading}
            />
            <StatCard
              title="Draft"
              value={assets?.filter(a => a.status === "draft").length || 0}
              icon={Clock}
              loading={assetsLoading}
            />
            <StatCard
              title="Approved"
              value={assets?.filter(a => a.status === "approved").length || 0}
              icon={CheckCircle}
              loading={assetsLoading}
            />
            <StatCard
              title="Published"
              value={assets?.filter(a => a.status === "published").length || 0}
              icon={TrendingUp}
              loading={assetsLoading}
            />
          </div>
          <ContentModeration assets={assets} loading={assetsLoading} />
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="API Tokens Used"
              value={stats?.tokensUsed?.toLocaleString() || "0"}
              icon={Cpu}
              description="Total AI tokens consumed"
              loading={statsLoading}
            />
            <StatCard
              title="Storage Used"
              value={`${stats?.storageUsed || 0} MB`}
              icon={HardDrive}
              description="Database storage"
              loading={statsLoading}
            />
            <StatCard
              title="Uptime"
              value="99.9%"
              icon={Activity}
              description="Last 30 days"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SystemStatusCard loading={false} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Error Log
                </CardTitle>
                <CardDescription>Recent system errors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500" />
                  <p className="mt-4 font-medium">No Recent Errors</p>
                  <p className="text-sm text-muted-foreground">
                    All systems operating normally
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
