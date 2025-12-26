import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  Zap,
  FileText,
  Bot,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import type { UsageLedger, WorkflowRun, Asset } from "@shared/schema";

const dateRanges = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const unitTypeLabels: Record<string, string> = {
  token: "AI Tokens",
  workflow_run: "Workflow Runs",
  export: "Exports",
  publish: "Publishes",
};

const unitTypeIcons: Record<string, typeof Zap> = {
  token: Zap,
  workflow_run: Bot,
  export: FileText,
  publish: TrendingUp,
};

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: string | number; 
  description: string;
  icon: typeof Zap;
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
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {trend && (
            <span className={`flex items-center text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function UsageChart({ data, loading }: { data: { date: string; tokens: number; runs: number }[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full" data-testid="card-usage-chart">
      <CardHeader>
        <CardTitle>Usage Over Time</CardTitle>
        <CardDescription>Daily AI token usage and workflow runs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRuns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area 
                type="monotone" 
                dataKey="tokens" 
                stroke="hsl(var(--primary))" 
                fill="url(#colorTokens)"
                strokeWidth={2}
                name="Tokens"
              />
              <Area 
                type="monotone" 
                dataKey="runs" 
                stroke="hsl(var(--chart-2))" 
                fill="url(#colorRuns)"
                strokeWidth={2}
                name="Runs"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageTable({ entries, loading }: { entries: UsageLedger[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full" data-testid="card-usage-table">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest usage entries</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.slice(0, 10).map((entry) => {
                const Icon = unitTypeIcons[entry.unitType] || Zap;
                return (
                  <TableRow key={entry.id} data-testid={`row-usage-${entry.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" size="sm">
                          {unitTypeLabels[entry.unitType] || entry.unitType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.description || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(entry.units).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {entry.createdAt ? format(new Date(entry.createdAt), "MMM d, h:mm a") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No usage data yet. Start creating content to track your usage.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Usage() {
  const [dateRange, setDateRange] = useState("30d");

  // Fetch usage data
  const { data: usage, isLoading: usageLoading } = useQuery<UsageLedger[]>({
    queryKey: ["/api/usage", { workspaceId: "default" }],
    queryFn: async () => {
      const res = await fetch("/api/usage?workspaceId=default");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch workflow runs for stats
  const { data: runs, isLoading: runsLoading } = useQuery<WorkflowRun[]>({
    queryKey: ["/api/workflow-runs"],
  });

  // Fetch assets for stats
  const { data: assets, isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const isLoading = usageLoading || runsLoading || assetsLoading;

  // Calculate stats
  const totalTokens = usage?.reduce((sum, entry) => 
    entry.unitType === "token" ? sum + Number(entry.units) : sum, 0) || 0;
  
  const totalRuns = runs?.length || 0;
  const successfulRuns = runs?.filter(r => r.status === "succeeded").length || 0;
  const totalAssets = assets?.length || 0;
  const approvedAssets = assets?.filter(a => a.status === "approved" || a.status === "published").length || 0;

  // Generate chart data
  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
  const chartData = Array.from({ length: Math.min(days, 14) }, (_, i) => {
    const date = subDays(new Date(), Math.min(days, 14) - 1 - i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayTokens = usage?.filter(entry => {
      if (!entry.createdAt || entry.unitType !== "token") return false;
      const entryDate = new Date(entry.createdAt);
      return entryDate >= dayStart && entryDate <= dayEnd;
    }).reduce((sum, entry) => sum + Number(entry.units), 0) || 0;
    
    const dayRuns = runs?.filter(run => {
      if (!run.createdAt) return false;
      const runDate = new Date(run.createdAt);
      return runDate >= dayStart && runDate <= dayEnd;
    }).length || 0;

    return {
      date: format(date, "MMM d"),
      tokens: dayTokens,
      runs: dayRuns,
    };
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl font-bold" data-testid="text-usage-title">
            Usage Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your AI usage, workflow runs, and content production.
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[160px]" data-testid="select-date-range">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateRanges.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="AI Tokens Used"
          value={totalTokens}
          description="Total tokens consumed by AI workflows"
          icon={Zap}
          loading={isLoading}
        />
        <StatCard
          title="Workflow Runs"
          value={totalRuns}
          description={`${successfulRuns} successful runs`}
          icon={Bot}
          loading={isLoading}
        />
        <StatCard
          title="Content Created"
          value={totalAssets}
          description={`${approvedAssets} approved or published`}
          icon={FileText}
          loading={isLoading}
        />
        <StatCard
          title="Success Rate"
          value={totalRuns > 0 ? `${Math.round((successfulRuns / totalRuns) * 100)}%` : "—"}
          description="Workflow completion rate"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Usage Chart */}
      <UsageChart data={chartData} loading={isLoading} />

      {/* Usage Table */}
      <UsageTable entries={usage || []} loading={isLoading} />

      {/* Billing Info Card */}
      <Card data-testid="card-billing-info">
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>Your current plan and billing status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Professional Plan</h4>
                <p className="text-sm text-muted-foreground">Unlimited workflows and team members</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
