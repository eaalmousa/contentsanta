import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Zap,
  Target
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface PipelineAnalytics {
  statusCounts: Record<string, number>;
  totalItems: number;
  successRate: number;
  avgProcessingTime: number | null;
  dailyTrends: Array<{ date: string; published: number; quarantined: number; total: number }>;
  topicPerformance: Array<{ topicId: string; topicName: string; published: number; quarantined: number; pending: number }>;
  jobRunStats: { total: number; byType: Record<string, number>; recentFailures: number };
}

const statusColors: Record<string, string> = {
  fetched: "#94a3b8",
  matched: "#a78bfa",
  deduped: "#818cf8",
  ranked: "#60a5fa",
  generated: "#22d3ee",
  gated: "#34d399",
  scheduled: "#fbbf24",
  publishing: "#f97316",
  published: "#22c55e",
  verified: "#10b981",
  retrying: "#f59e0b",
  quarantined: "#ef4444",
  skipped: "#6b7280",
};

const CHART_COLORS = ["#22c55e", "#ef4444", "#60a5fa", "#f59e0b", "#a78bfa"];

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: any;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trendUp ? "text-green-600" : "text-red-600"}`}>
            <TrendingUp className={`h-3 w-3 ${!trendUp ? "rotate-180" : ""}`} />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusDistributionChart({ statusCounts }: { statusCounts: Record<string, number> }) {
  const data = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      fill: statusColors[status] || "#6b7280",
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No pipeline items yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function DailyTrendChart({ data }: { data: Array<{ date: string; published: number; quarantined: number; total: number }> }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data for the last 30 days
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }} 
          tickLine={false}
          className="text-muted-foreground"
        />
        <YAxis 
          tick={{ fontSize: 12 }} 
          tickLine={false}
          className="text-muted-foreground"
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--card))", 
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px"
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="published" 
          stroke="#22c55e" 
          strokeWidth={2}
          dot={false}
          name="Published"
        />
        <Line 
          type="monotone" 
          dataKey="quarantined" 
          stroke="#ef4444" 
          strokeWidth={2}
          dot={false}
          name="Quarantined"
        />
        <Line 
          type="monotone" 
          dataKey="total" 
          stroke="#60a5fa" 
          strokeWidth={2}
          dot={false}
          name="Total"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TopicPerformanceChart({ 
  data 
}: { 
  data: Array<{ topicId: string; topicName: string; published: number; quarantined: number; pending: number }> 
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No topics with pipeline data
      </div>
    );
  }

  const chartData = data.map(t => ({
    name: t.topicName.length > 15 ? t.topicName.substring(0, 15) + "..." : t.topicName,
    published: t.published,
    quarantined: t.quarantined,
    pending: t.pending,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fontSize: 11 }} 
          width={100}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--card))", 
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px"
          }}
        />
        <Legend />
        <Bar dataKey="published" fill="#22c55e" name="Published" stackId="a" />
        <Bar dataKey="quarantined" fill="#ef4444" name="Quarantined" stackId="a" />
        <Bar dataKey="pending" fill="#60a5fa" name="In Progress" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function JobTypeChart({ byType }: { byType: Record<string, number> }) {
  const data = Object.entries(byType).map(([type, count], idx) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No job runs yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 10 }} 
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--card))", 
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px"
          }}
        />
        <Bar dataKey="value" name="Runs">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Analytics() {
  const { data: analytics, isLoading } = useQuery<PipelineAnalytics>({
    queryKey: ["/api/analytics/pipeline", { workspaceId: "demo-workspace" }],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Pipeline performance and content metrics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const {
    statusCounts = {},
    totalItems = 0,
    successRate = 0,
    avgProcessingTime,
    dailyTrends = [],
    topicPerformance = [],
    jobRunStats = { total: 0, byType: {}, recentFailures: 0 },
  } = analytics || {};

  const publishedCount = (statusCounts["published"] || 0) + (statusCounts["verified"] || 0);
  const quarantinedCount = statusCounts["quarantined"] || 0;
  const inProgressCount = totalItems - publishedCount - quarantinedCount - (statusCounts["skipped"] || 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-analytics-title">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Pipeline performance and content metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pipeline Items"
          value={totalItems}
          description={`${inProgressCount} currently in progress`}
          icon={Activity}
        />
        <StatCard
          title="Published"
          value={publishedCount}
          description="Successfully published to targets"
          icon={CheckCircle2}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          description="Of completed items published successfully"
          icon={Target}
          trend={successRate >= 80 ? "Good performance" : "Needs attention"}
          trendUp={successRate >= 80}
        />
        <StatCard
          title="Avg Processing Time"
          value={avgProcessingTime !== null ? `${avgProcessingTime} min` : "N/A"}
          description="From fetch to publish"
          icon={Clock}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Quarantined"
          value={quarantinedCount}
          description="Items requiring attention"
          icon={AlertTriangle}
        />
        <StatCard
          title="Total Job Runs"
          value={jobRunStats.total}
          description={`${jobRunStats.recentFailures} recent failures`}
          icon={Zap}
        />
        <StatCard
          title="Active Topics"
          value={topicPerformance.length}
          description="Topics with pipeline activity"
          icon={BarChart3}
        />
        <StatCard
          title="Today's Activity"
          value={dailyTrends.length > 0 ? dailyTrends[dailyTrends.length - 1]?.total || 0 : 0}
          description="Items processed today"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Trends (Last 30 Days)</CardTitle>
            <CardDescription>Pipeline activity over time</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyTrendChart data={dailyTrends} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current pipeline item statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart statusCounts={statusCounts} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Topic Performance</CardTitle>
            <CardDescription>Publishing success by topic</CardDescription>
          </CardHeader>
          <CardContent>
            <TopicPerformanceChart data={topicPerformance} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Type Distribution</CardTitle>
            <CardDescription>Automation job runs by type</CardDescription>
          </CardHeader>
          <CardContent>
            <JobTypeChart byType={jobRunStats.byType} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusColors).map(([status, color]) => (
              <Badge 
                key={status} 
                variant="outline" 
                style={{ borderColor: color, color }}
                className="capitalize"
              >
                <span 
                  className="w-2 h-2 rounded-full mr-1.5" 
                  style={{ backgroundColor: color }}
                />
                {status}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
