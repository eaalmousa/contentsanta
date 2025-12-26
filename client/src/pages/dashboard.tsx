import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Asset, Input, WorkflowRun } from "@shared/schema";

interface DashboardStats {
  totalInputs: number;
  totalAssets: number;
  workflowRuns: number;
  approvedAssets: number;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType; 
  trend?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="font-serif text-3xl font-bold">{value}</span>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                <span>{trend}</span>
              </div>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ 
  title, 
  description, 
  href, 
  icon: Icon 
}: { 
  title: string; 
  description: string; 
  href: string; 
  icon: React.ElementType;
}) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer transition-colors hover-elevate">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </CardContent>
      </Card>
    </Link>
  );
}

function RecentAssetRow({ asset }: { asset: Asset }) {
  const statusColors: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    published: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-medium truncate">{asset.title}</span>
        <span className="text-xs text-muted-foreground capitalize">
          {asset.workflowType?.replace(/_/g, " ") || "Unknown workflow"}
        </span>
      </div>
      <Badge variant="secondary" className={statusColors[asset.status] || ""}>
        {asset.status}
      </Badge>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentAssets, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets", { limit: 5 }],
  });

  const { data: recentRuns, isLoading: runsLoading } = useQuery<WorkflowRun[]>({
    queryKey: ["/api/workflow-runs", { limit: 5 }],
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-bold" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your content production.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="stats-grid">
        <StatCard
          title="Total Inputs"
          value={stats?.totalInputs || 0}
          icon={FileText}
          loading={statsLoading}
        />
        <StatCard
          title="Generated Assets"
          value={stats?.totalAssets || 0}
          icon={Sparkles}
          trend="+12% this week"
          loading={statsLoading}
        />
        <StatCard
          title="Workflow Runs"
          value={stats?.workflowRuns || 0}
          icon={Clock}
          loading={statsLoading}
        />
        <StatCard
          title="Approved"
          value={stats?.approvedAssets || 0}
          icon={CheckCircle2}
          loading={statsLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Create New Content"
            description="Add text, URL, or upload documents"
            href="/create"
            icon={Plus}
          />
          <QuickActionCard
            title="Run AI Workflow"
            description="Transform content with AI"
            href="/workflows"
            icon={Sparkles}
          />
          <QuickActionCard
            title="Browse Library"
            description="View all your content assets"
            href="/library"
            icon={FileText}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="font-serif text-lg">Recent Assets</CardTitle>
            <Link href="/library">
              <Button variant="ghost" size="sm" data-testid="link-view-all-assets">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {assetsLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : recentAssets && recentAssets.length > 0 ? (
              <div className="divide-y">
                {recentAssets.map((asset) => (
                  <RecentAssetRow key={asset.id} asset={asset} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">No assets yet</span>
                  <span className="text-sm text-muted-foreground">
                    Create content and run workflows to generate assets
                  </span>
                </div>
                <Link href="/create">
                  <Button size="sm" data-testid="button-create-first-content">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Content
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Workflow Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="font-serif text-lg">Recent Workflows</CardTitle>
            <Link href="/workflows">
              <Button variant="ghost" size="sm" data-testid="link-view-all-workflows">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {runsLoading ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : recentRuns && recentRuns.length > 0 ? (
              <div className="divide-y">
                {recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium capitalize">
                        {run.workflowType.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "Unknown"}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        run.status === "completed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : run.status === "running"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : run.status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          : ""
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground/50" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">No workflows run yet</span>
                  <span className="text-sm text-muted-foreground">
                    Run your first AI workflow to transform content
                  </span>
                </div>
                <Link href="/workflows">
                  <Button size="sm" data-testid="button-run-first-workflow">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run Workflow
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
