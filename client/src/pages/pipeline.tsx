import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import {
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  RotateCcw,
  Loader2,
  ChevronDown,
  Eye,
  Zap,
  Timer,
  FileText,
  Send,
  Shield,
  Calendar,
  ExternalLink,
  Copy,
  TrendingUp,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Topic, PipelineItem, PublishingItem } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { useWorkspaceContext } from "@/hooks/use-workspace-context";

type PipelineItemWithStory = PipelineItem & {
  story: {
    id: string;
    canonicalTitle: string;
    excerpt: string;
  } | null;
  topicName?: string;
};

type PublishingItemWithPipelineItem = PublishingItem & {
  pipelineItem: PipelineItemWithStory;
};

type JobRun = {
  id: string;
  topicId: string;
  workspaceId: string;
  jobType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  processedCount: number;
  successCount: number;
  failCount: number;
  skipCount: number;
  quarantineCount: number;
  logsJson: any;
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  fetched: { label: "Fetched", color: "bg-slate-500", icon: FileText },
  matched: { label: "Matched", color: "bg-blue-500", icon: Filter },
  deduped: { label: "Deduped", color: "bg-cyan-500", icon: CheckCircle2 },
  ranked: { label: "Ranked", color: "bg-indigo-500", icon: Zap },
  generated: { label: "Generated", color: "bg-purple-500", icon: FileText },
  gated: { label: "Gated", color: "bg-amber-500", icon: Shield },
  scheduled: { label: "Scheduled", color: "bg-orange-500", icon: Calendar },
  publishing: { label: "Publishing", color: "bg-yellow-500", icon: Timer },
  published: { label: "Published", color: "bg-green-500", icon: Send },
  verified: { label: "Verified", color: "bg-emerald-600", icon: CheckCircle2 },
  retrying: { label: "Retrying", color: "bg-amber-600", icon: RefreshCw },
  quarantined: { label: "Quarantined", color: "bg-red-500", icon: AlertCircle },
  skipped: { label: "Skipped", color: "bg-gray-400", icon: Clock },
  // Publishing-specific statuses
  draft_ready: { label: "Draft Ready", color: "bg-blue-500", icon: FileText },
  editor_review: { label: "Editor Review", color: "bg-purple-500", icon: Eye },
  pushing: { label: "Pushing", color: "bg-yellow-500", icon: Send },
  publish_failed: { label: "Publish Failed", color: "bg-red-500", icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, color: "bg-gray-500", icon: Clock };
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} text-white gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function PipelineItemCard({
  item,
  onRetry,
  onPublishNow,
  onHandoff
}: {
  item: PipelineItemWithStory;
  onRetry: (id: string) => void;
  onPublishNow: (id: string) => void;
  onHandoff?: (id: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const canRetry = item.status === "quarantined" || item.status === "retrying";
  const canPublishNow = item.status === "scheduled";
  const canHandoff = item.status === "generated" || item.status === "gated" || item.status === "scheduled";
  const statusInfo = statusConfig[item.status] || { label: item.status, color: "bg-gray-500", icon: Clock };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -2, scale: 1.005 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/20 hover:bg-card/60 transition-all duration-300"
      >
        {/* Status Strip */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusInfo.color}`} />

        <div className="p-4 pl-5 flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              {item.topicName && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background/50 border-border/30 text-muted-foreground">
                  {item.topicName}
                </Badge>
              )}
              {item.score && (
                <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/20 px-1.5 py-0.5 rounded border border-border/20">
                  Sc: {parseFloat(item.score as any).toFixed(2)}
                </span>
              )}
            </div>

            <div>
              <h4 className="font-medium text-sm leading-tight text-foreground/90 truncate pr-8">
                {item.generatedTitle || item.story?.canonicalTitle || "Untitled Item"}
              </h4>
              <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 leading-relaxed">
                {item.generatedExcerpt || item.story?.excerpt || "No content preview available"}
              </p>
            </div>

            {item.lastErrorMessage && (
              <div className="mt-2 p-2 bg-destructive/5 border border-destructive/10 rounded-md flex items-start gap-2">
                <AlertCircle className="w-3 h-3 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-[10px] text-destructive">
                  <span className="font-semibold">{item.lastErrorCode}:</span> {item.lastErrorMessage}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : "Unknown"}
              </span>

              {(item.retryCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-orange-500/80">
                  <RotateCcw className="w-3 h-3" />
                  Retry {item.retryCount}/5
                </span>
              )}

              {item.status === "scheduled" && item.scheduledFor && (
                <span className="flex items-center gap-1 text-orange-600 font-medium ml-auto bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
                  <Calendar className="w-3 h-3" />
                  {new Date(item.scheduledFor) <= new Date()
                    ? "Due Now"
                    : `${formatDistanceToNow(new Date(item.scheduledFor))}`}
                </span>
              )}
            </div>
          </div>

          <div className={`flex flex-col gap-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
              onClick={() => setShowDetails(true)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>

            {canHandoff && onHandoff && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                onClick={() => onHandoff(item.id)}
                title="Hand Off to Publishing"
              >
                <TrendingUp className="h-4 w-4" />
              </Button>
            )}

            {canPublishNow && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                onClick={() => onPublishNow(item.id)}
                title="Publish Immediately"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}

            {canRetry && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-full text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={() => onRetry(item.id)}
                title="Retry Item"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl bg-background/80 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              <span className="truncate">Pipeline Item Details</span>
            </DialogTitle>
            <DialogDescription className="font-medium text-foreground/80 pt-2">
              {item.story?.canonicalTitle || "Unknown Story"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/30">
                  <span className="text-muted-foreground block mb-1">Status</span>
                  <div className="font-medium capitalize">{item.status}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/30">
                  <span className="text-muted-foreground block mb-1">Score</span>
                  <div className="font-medium">{parseFloat(item.score as any || "0").toFixed(3)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/30">
                  <span className="text-muted-foreground block mb-1">Retries</span>
                  <div className="font-medium">{item.retryCount}/5</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/30">
                  <span className="text-muted-foreground block mb-1">Created</span>
                  <div className="font-medium">
                    {item.createdAt ? formatDistanceToNow(new Date(item.createdAt)) + " ago" : "N/A"}
                  </div>
                </div>
              </div>

              {item.lastErrorMessage && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Error Details
                  </h4>
                  <p className="text-sm text-foreground">
                    <span className="font-mono bg-background/50 px-1 rounded mr-2">{item.lastErrorCode}</span>
                    {item.lastErrorMessage}
                  </p>
                </div>
              )}

              {(item.generatedTitle) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-sm">Generated Content</h4>
                  </div>

                  {item.generatedTitle && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Title</span>
                      <p className="text-sm font-medium bg-muted/30 p-2 rounded border border-border/30">{item.generatedTitle}</p>
                    </div>
                  )}

                  {item.generatedExcerpt && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Excerpt</span>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded border border-border/30 italic">{item.generatedExcerpt}</p>
                    </div>
                  )}
                </div>
              )}

              {item.targetPostId && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Published Successfully
                    </h4>
                    <p className="text-xs text-muted-foreground">Post ID: {item.targetPostId}</p>
                  </div>
                  {item.targetPermalink && (
                    <Button variant="outline" size="sm" asChild className="gap-1 h-8">
                      <a href={item.targetPermalink} target="_blank" rel="noopener noreferrer">
                        View Post <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            {canRetry && (
              <Button onClick={() => { onRetry(item.id); setShowDetails(false); }} variant="secondary">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Item
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function JobRunCard({ run }: { run: JobRun }) {
  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <div className={`h-2 w-2 rounded-full ${run.status === "completed" ? "bg-green-500" : run.status === "running" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{run.jobType}</Badge>
          <span className="text-xs text-muted-foreground">
            {run.startedAt ? formatDistanceToNow(new Date(run.startedAt)) + " ago" : "N/A"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="text-green-600">{run.successCount} success</span>
          {run.failCount > 0 && <span className="text-red-600">{run.failCount} failed</span>}
          {run.skipCount > 0 && <span className="text-gray-500">{run.skipCount} skipped</span>}
          {run.quarantineCount > 0 && <span className="text-orange-600">{run.quarantineCount} quarantined</span>}
        </div>
      </div>
    </div>
  );
}

type AutomationActivity = {
  automationMode: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  stats: {
    totalGenerated: number;
    totalPublished: number;
    totalQuarantined: number;
    draftsCreated: number;
    draftsPendingReview: number;
    draftsApproved: number;
    draftsPublished: number;
    currentQuarantined: number;
    awaitingGate: number;
    awaitingSchedule: number;
    todayPublished: number;
  };
  recentRuns: Array<{
    id: string;
    jobType: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    processed: number;
    success: number;
    failed: number;
    quarantined: number;
  }>;
};

function AutomationOverviewBanner({
  topics,
  quarantinedCount,
  onTriggerAll,
  isPending
}: {
  topics: Topic[];
  quarantinedCount: number;
  onTriggerAll: () => void;
  isPending: boolean;
}) {
  const { toast } = useToast();

  const automatedTopics = topics.filter(t => t.automationMode === "auto" || t.automationMode === "approval_required");

  const topicIds = automatedTopics.map(t => t.id).sort().join(",");

  const { data: activitiesMap, isLoading, isError } = useQuery<Record<string, AutomationActivity>>({
    queryKey: ["/api/automation-overview", topicIds],
    queryFn: async () => {
      const results: Record<string, AutomationActivity> = {};
      const errors: string[] = [];
      const batchSize = 5;
      for (let i = 0; i < automatedTopics.length; i += batchSize) {
        const batch = automatedTopics.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (topic) => {
            try {
              const res = await fetch(`/api/topics/${topic.id}/automation-activity`, { credentials: "include" });
              if (res.ok) {
                results[topic.id] = await res.json();
              } else {
                errors.push(`Failed to fetch activity for topic ${topic.id}: ${res.status}`);
              }
            } catch (err: any) {
              errors.push(`Error fetching topic ${topic.id}: ${err.message}`);
            }
          })
        );
      }
      if (errors.length > 0 && Object.keys(results).length === 0) {
        throw new Error(errors.join("; "));
      }
      return results;
    },
    enabled: automatedTopics.length > 0,
    refetchInterval: 60000,
  });

  const allActivities = Object.values(activitiesMap || {});

  const todayGenerated = allActivities.reduce((sum, a) => sum + (a.stats?.totalGenerated || 0), 0);
  const todayPublished = allActivities.reduce((sum, a) => sum + (a.stats?.todayPublished || 0), 0);
  const totalQuarantined = allActivities.reduce((sum, a) => sum + (a.stats?.currentQuarantined || 0), 0);
  const pendingReview = allActivities.reduce((sum, a) => sum + (a.stats?.draftsPendingReview || 0), 0);

  const lastRunTimes = allActivities
    .filter(a => a.lastRunAt)
    .map(a => new Date(a.lastRunAt!).getTime());
  const lastGlobalRun = lastRunTimes.length > 0 ? new Date(Math.max(...lastRunTimes)) : null;

  const failingTopics = automatedTopics.filter(t => {
    const activity = activitiesMap?.[t.id];
    return activity && (activity.stats?.currentQuarantined || 0) > 0;
  });

  const copyDebugBundle = async () => {
    const bundle = {
      timestamp: new Date().toISOString(),
      automatedTopicsCount: automatedTopics.length,
      lastGlobalRun: lastGlobalRun?.toISOString() || null,
      totals: {
        generated: todayGenerated,
        published: todayPublished,
        quarantined: totalQuarantined,
        pendingReview,
      },
      failingTopics: failingTopics.map(t => ({
        id: t.id,
        name: t.name,
        quarantined: activitiesMap?.[t.id]?.stats?.currentQuarantined || 0,
      })),
      topicActivities: Object.entries(activitiesMap || {}).map(([id, activity]) => ({
        topicId: id,
        topicName: automatedTopics.find(t => t.id === id)?.name,
        lastRunAt: activity.lastRunAt,
        lastRunStatus: activity.lastRunStatus,
        recentJobs: activity.recentRuns?.slice(0, 5),
      })),
    };

    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    toast({ title: "Debug bundle copied", description: "Global pipeline stats copied to clipboard" });
  };

  if (automatedTopics.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6" data-testid="automation-overview-banner">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Automation Overview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={copyDebugBundle}
              data-testid="button-copy-global-debug"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Debug Bundle
            </Button>
            <Button
              onClick={onTriggerAll}
              disabled={isPending}
              data-testid="button-trigger-all-pipelines"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run All Pipelines
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{automatedTopics.length}</div>
                <div className="text-xs text-muted-foreground">Active Pipelines</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{todayGenerated}</div>
                <div className="text-xs text-muted-foreground">Generated</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{todayPublished}</div>
                <div className="text-xs text-muted-foreground">Published Today</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-amber-600">{pendingReview}</div>
                <div className="text-xs text-muted-foreground">Pending Review</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className={`text-2xl font-bold ${totalQuarantined > 0 ? "text-destructive" : ""}`}>
                  {totalQuarantined}
                </div>
                <div className="text-xs text-muted-foreground">Quarantined</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Last global run: {lastGlobalRun
                  ? formatDistanceToNow(lastGlobalRun) + " ago"
                  : "Never"}
              </span>
              <span>Pipeline cycle: every 10 min</span>
            </div>

            {failingTopics.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-destructive">Failing Topics ({failingTopics.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {failingTopics.slice(0, 5).map(topic => (
                    <Badge key={topic.id} variant="destructive" className="text-xs">
                      {topic.name} ({activitiesMap?.[topic.id]?.stats?.currentQuarantined || 0} quarantined)
                    </Badge>
                  ))}
                  {failingTopics.length > 5 && (
                    <Badge variant="outline" className="text-xs">+{failingTopics.length - 5} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublishedItemsList({ workspaceId, topicId }: { workspaceId?: string; topicId?: string }) {
  const { data: publishedItems = [], isLoading } = useQuery<PipelineItemWithStory[]>({
    queryKey: ["/api/pipeline/published", workspaceId, topicId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workspaceId) params.append("workspaceId", workspaceId);
      if (topicId) params.append("topicId", topicId);
      params.append("limit", "50");
      const res = await apiRequest("GET", `/api/pipeline/published?${params.toString()}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (publishedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4" />
        <p className="font-medium">No published items yet</p>
        <p className="text-xs mt-1">Published articles will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {publishedItems.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-2">
                  {item.generatedTitle || item.story?.canonicalTitle || "Untitled"}
                </h4>
                {item.story?.excerpt && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.story.excerpt}
                  </p>
                )}
              </div>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Published
              </Badge>
            </div>

            {item.targetPermalink && (
              <a
                href={item.targetPermalink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View Published Article
              </a>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Topic: {item.topicName || "Unknown"}</span>
              <span>•</span>
              <span>
                Published{" "}
                {item.publishedAt
                  ? formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })
                  : "recently"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function PublishingItemsList({ topicId }: { topicId?: string }) {
  const { toast } = useToast();
  
  const { data: publishingItems = [], isLoading } = useQuery<PublishingItemWithPipelineItem[]>({
    queryKey: ["/api/publishing-items", topicId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (topicId) params.append("topicId", topicId);
      const res = await apiRequest("GET", `/api/publishing-items?${params.toString()}`);
      return res.json();
    },
    enabled: !!topicId,
  });

  const pushMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/publishing-items/${id}/push`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Publishing triggered", description: "Item is being published to WordPress" });
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-items", topicId] });
    },
    onError: (error: any) => {
      toast({ title: "Push failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (publishingItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Send className="h-12 w-12 mb-4" />
        <p className="font-medium">No publishing items yet</p>
        <p className="text-xs mt-1">Items handed off to publishing will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px]">
      <div className="space-y-3">
        {publishingItems.map((pubItem) => {
          const item = pubItem.pipelineItem;
          return (
            <div key={pubItem.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-sm line-clamp-2">
                    {item.generatedTitle || item.story?.canonicalTitle || "Untitled"}
                  </h4>
                  {item.story?.excerpt && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.story.excerpt}
                    </p>
                  )}
                </div>
                <StatusBadge status={pubItem.status} />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Topic: {item.topicName || "Unknown"}</span>
                <span>•</span>
                <span>
                  Handed off{" "}
                  {pubItem.handedOffAt
                    ? formatDistanceToNow(new Date(pubItem.handedOffAt), { addSuffix: true })
                    : "recently"}
                </span>
                {pubItem.attemptCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-600">Attempts: {pubItem.attemptCount}</span>
                  </>
                )}
              </div>

              {pubItem.scheduledAt && (
                <div className="flex items-center gap-2 text-xs text-orange-600">
                  <Calendar className="h-3 w-3" />
                  Scheduled: {new Date(pubItem.scheduledAt) <= new Date()
                    ? "Due now"
                    : formatDistanceToNow(new Date(pubItem.scheduledAt))}
                </div>
              )}

              {pubItem.lastError && (
                <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-xs">
                  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Error: </span>
                    <span className="text-muted-foreground">{pubItem.lastError}</span>
                  </div>
                </div>
              )}

              {pubItem.publishedUrl && (
                <a
                  href={pubItem.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Published Article
                </a>
              )}

              {(pubItem.status === "draft_ready" || pubItem.status === "scheduled" || pubItem.status === "publish_failed") && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pushMutation.mutate(pubItem.id)}
                    disabled={pushMutation.isPending}
                  >
                    {pushMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Push Now
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function SkippedItemsList({ workspaceId, topicId }: { workspaceId?: string; topicId?: string }) {
  const { data: skippedItems = [], isLoading } = useQuery<PipelineItemWithStory[]>({
    queryKey: ["/api/pipeline/skipped", workspaceId, topicId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workspaceId) params.append("workspaceId", workspaceId);
      if (topicId) params.append("topicId", topicId);
      params.append("limit", "50");
      const res = await apiRequest("GET", `/api/pipeline/skipped?${params.toString()}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (skippedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Shield className="h-12 w-12 mb-4" />
        <p className="font-medium">No skipped items</p>
        <p className="text-xs mt-1">Items filtered by quality gates will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {skippedItems.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-2">
                  {item.generatedTitle || item.story?.canonicalTitle || "Untitled"}
                </h4>
                {item.story?.excerpt && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.story.excerpt}
                  </p>
                )}
              </div>
              <StatusBadge status={item.status} />
            </div>

            {item.skipReason && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-xs">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Skip Reason: </span>
                  <span className="text-muted-foreground">{item.skipReason}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Topic: {item.topicName || "Unknown"}</span>
              <span>•</span>
              <span>
                {item.createdAt
                  ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                  : "Unknown time"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default function Pipeline() {
  const { toast } = useToast();
  const searchParams = useSearch();
  const { activeWorkspaceId, isLoading: isContextLoading } = useWorkspaceContext();
  const urlTopicId = new URLSearchParams(searchParams).get("topic");

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(urlTopicId);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("items");

  // Set topic from URL parameter on mount
  useEffect(() => {
    if (urlTopicId && !selectedTopicId) {
      setSelectedTopicId(urlTopicId);
    }
  }, [urlTopicId, selectedTopicId]);

  // Debug: Track component mount/unmount
  useEffect(() => {
    console.log("[Pipeline] mount");
    return () => console.log("[Pipeline] unmount");
  }, []);

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const automatedTopics = topics.filter(t => t.automationMode === "auto" || t.automationMode === "approval_required");

  const { data: pipelineItems = [], isLoading: isLoadingItems } = useQuery<PipelineItemWithStory[]>({
    queryKey: ["/api/topics", selectedTopicId, "pipeline-items"],
    enabled: !!selectedTopicId,
  });

  const { data: quarantinedItems = [], isLoading: isLoadingQuarantine } = useQuery<PipelineItemWithStory[]>({
    queryKey: ["/api/quarantine", { workspaceId: activeWorkspaceId || "demo-workspace" }],
  });

  const { data: jobRuns = [] } = useQuery<JobRun[]>({
    queryKey: ["/api/topics", selectedTopicId, "job-runs"],
    enabled: !!selectedTopicId,
  });

  // Filter pipeline items by lifecycle stage
  const discoveryItems = pipelineItems.filter(item => 
    ['fetched', 'matched', 'deduped', 'ranked'].includes(item.status)
  );
  
  const generationItems = pipelineItems.filter(item => 
    ['generated', 'gated'].includes(item.status)
  );
  
  const publishingPipelineItems = pipelineItems.filter(item => 
    ['scheduled', 'publishing', 'published', 'verified', 'retrying'].includes(item.status)
  );

  // Compute effective loading state - gate on workspace readiness
  const effectiveLoading = isContextLoading || !activeWorkspaceId || isLoadingItems || isLoadingQuarantine;

  // Debug: Track component render
  console.log("[Pipeline] render", {
    isContextLoading,
    activeWorkspaceId: activeWorkspaceId ? "present" : "missing",
    effectiveLoading,
    topicsCount: topics.length,
    selectedTopicId,
    itemsCount: pipelineItems.length,
    quarantinedCount: quarantinedItems.length
  });

  const runPipelineMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const res = await apiRequest("POST", `/api/topics/${topicId}/run-pipeline`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Pipeline started", description: "The pipeline is now running for this topic" });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopicId, "pipeline-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopicId, "job-runs"] });
    },
    onError: (error: any) => {
      toast({ title: "Pipeline failed", description: error.message, variant: "destructive" });
    },
  });

  const triggerAllPipelinesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trigger-pipelines");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "All pipelines triggered",
        description: `${data.pipelinesProcessed || 0} pipelines processed`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quarantine"] });
    },
    onError: (error: any) => {
      toast({ title: "Trigger failed", description: error.message, variant: "destructive" });
    },
  });

  const retryItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", `/api/pipeline-items/${itemId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item queued for retry", description: "The item will be reprocessed" });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopicId, "pipeline-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quarantine"] });
    },
    onError: (error: any) => {
      toast({ title: "Retry failed", description: error.message, variant: "destructive" });
    },
  });

  const publishNowMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", `/api/pipeline-items/${itemId}/publish-now`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.status === "published" ? "Published!" : "Publishing...",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopicId, "pipeline-items"] });
    },
    onError: (error: any) => {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: async (pipelineItemId: string) => {
      const res = await apiRequest("POST", `/api/publishing-items/${pipelineItemId}/handoff`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Handed off to publishing", description: "Item is now in the publishing pipeline" });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopicId, "pipeline-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-items", selectedTopicId] });
    },
    onError: (error: any) => {
      toast({ title: "Handoff failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredDiscoveryItems = statusFilter === "all"
    ? discoveryItems
    : discoveryItems.filter(item => item.status === statusFilter);
  
  const filteredGenerationItems = statusFilter === "all"
    ? generationItems
    : generationItems.filter(item => item.status === statusFilter);

  const statusCounts = pipelineItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Early guard: Show loading if workspace not ready or initial data loading
  if (isContextLoading || !activeWorkspaceId || (isLoadingItems && !pipelineItems.length)) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        {/* DEBUG BADGE - Confirms updated code is running */}
        <div className="fixed top-16 right-4 z-50 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-mono shadow-lg">
          Pipeline Loading Guard Active
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">
              {isContextLoading || !activeWorkspaceId ? "Loading workspace..." : "Loading pipeline..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Pipeline Automation</h1>
          <p className="text-muted-foreground">
            Monitor and manage your automated content pipeline
          </p>
        </div>
      </div>

      <AutomationOverviewBanner
        topics={topics}
        quarantinedCount={quarantinedItems.length}
        onTriggerAll={() => triggerAllPipelinesMutation.mutate()}
        isPending={triggerAllPipelinesMutation.isPending}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Automated Topics</CardTitle>
            <CardDescription>
              {automatedTopics.length} topics with automation enabled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {automatedTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedTopicId === topic.id
                      ? "bg-primary/10 border-primary border"
                      : "border hover-elevate"
                      }`}
                    onClick={() => setSelectedTopicId(topic.id)}
                    data-testid={`topic-select-${topic.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{topic.name}</span>
                      <Badge variant={topic.automationMode === "auto" ? "default" : "secondary"}>
                        {topic.automationMode}
                      </Badge>
                    </div>
                    {topic.publishedToday !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Published today: {topic.publishedToday} / {topic.dailyCap || "∞"}
                      </p>
                    )}
                  </div>
                ))}
                {automatedTopics.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No topics with automation enabled.
                    Enable automation in topic settings.
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedTopicId
                    ? topics.find(t => t.id === selectedTopicId)?.name
                    : "Select a Topic"}
                </CardTitle>
                <CardDescription>
                  {selectedTopicId
                    ? `Discovery: ${discoveryItems.length} | Generation: ${generationItems.length} | Publishing: ${publishingPipelineItems.length}`
                    : "Choose a topic from the list to view pipeline stages"}
                </CardDescription>
              </div>
              {selectedTopicId && (
                <Button
                  size="sm"
                  onClick={() => runPipelineMutation.mutate(selectedTopicId)}
                  disabled={runPipelineMutation.isPending}
                  data-testid="button-run-pipeline"
                >
                  {runPipelineMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Pipeline
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedTopicId ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="items" data-testid="tab-items">
                      Discovery ({discoveryItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="generation" data-testid="tab-generation">
                      Generation ({generationItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="publishing" data-testid="tab-publishing">
                      Publishing ({publishingPipelineItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" data-testid="tab-history">Job History</TabsTrigger>
                  </TabsList>

                  {(activeTab === "items" || activeTab === "generation") && (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.label} {statusCounts[key] ? `(${statusCounts[key]})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <TabsContent value="items">
                  <ScrollArea className="h-[350px]">
                    {(isLoadingItems || isContextLoading) ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground ml-2">
                          {isContextLoading ? "Loading workspace..." : "Loading..."}
                        </p>
                      </div>
                    ) : filteredDiscoveryItems.length > 0 ? (
                      <div className="space-y-2">
                        {filteredDiscoveryItems.map((item) => (
                          <PipelineItemCard
                            key={item.id}
                            item={item}
                            onRetry={(id) => retryItemMutation.mutate(id)}
                            onPublishNow={(id) => publishNowMutation.mutate(id)}
                            onHandoff={(id) => handoffMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 space-y-3">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          No discovery items found
                          {statusFilter !== "all" && ` with status "${statusFilter}"`}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="generation">
                  <ScrollArea className="h-[350px]">
                    {(isLoadingItems || isContextLoading) ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground ml-2">Loading...</p>
                      </div>
                    ) : filteredGenerationItems.length > 0 ? (
                      <div className="space-y-2">
                        {filteredGenerationItems.map((item) => (
                          <PipelineItemCard
                            key={item.id}
                            item={item}
                            onRetry={(id) => retryItemMutation.mutate(id)}
                            onPublishNow={(id) => publishNowMutation.mutate(id)}
                            onHandoff={(id) => handoffMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 space-y-3">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          No items in generation
                          {statusFilter !== "all" && ` with status "${statusFilter}"`}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="publishing">
                  <ScrollArea className="h-[350px]">
                    {(isLoadingItems || isContextLoading) ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground ml-2">Loading publishing items...</p>
                      </div>
                    ) : publishingPipelineItems.length > 0 ? (
                      <div className="space-y-2">
                        {publishingPipelineItems.map((item) => (
                          <PipelineItemCard
                            key={item.id}
                            item={item}
                            onRetry={(id) => retryItemMutation.mutate(id)}
                            onPublishNow={(id) => publishNowMutation.mutate(id)}
                            onHandoff={(id) => handoffMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 space-y-3">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          No items in publishing pipeline
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Items will appear here after generation is complete
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="history">
                  <ScrollArea className="h-[350px]">
                    {jobRuns.length > 0 ? (
                      <div className="space-y-2">
                        {jobRuns.map((run) => (
                          <JobRunCard key={run.id} run={run} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-12">
                        No job runs yet for this topic
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Zap className="h-12 w-12 mb-4 opacity-50" />
                <p>Select a topic to view pipeline details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Item History & Status
              </CardTitle>
              <CardDescription>
                View quarantined, published, and skipped items with reasons
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="quarantined" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quarantined" className="relative">
                Quarantined
                {quarantinedItems.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                    {quarantinedItems.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="skipped">Skipped</TabsTrigger>
            </TabsList>

            <TabsContent value="quarantined" className="mt-4">
              {isLoadingQuarantine ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : quarantinedItems.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {quarantinedItems.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm line-clamp-2">
                              {item.generatedTitle || item.story?.canonicalTitle || "Untitled"}
                            </h4>
                            {item.story?.excerpt && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {item.story.excerpt}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={item.status} />
                        </div>

                        {item.quarantineReason && (
                          <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-xs">
                            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-medium">Reason: </span>
                              <span className="text-muted-foreground">{item.quarantineReason}</span>
                              {item.lastErrorMessage && (
                                <div className="mt-1 text-muted-foreground">
                                  {item.lastErrorMessage}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Topic: {item.topicName || "Unknown"}</span>
                          <span>•</span>
                          <span>
                            {item.createdAt
                              ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
                              : "Unknown time"}
                          </span>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryItemMutation.mutate(item.id)}
                            disabled={retryItemMutation.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => publishNowMutation.mutate(item.id)}
                            disabled={publishNowMutation.isPending}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Publish Now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                  <p className="font-medium">No quarantined items - all clear!</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="published" className="mt-4">
              <PublishedItemsList
                workspaceId={activeWorkspaceId || undefined}
                topicId={selectedTopicId || undefined}
              />
            </TabsContent>
            <TabsContent value="skipped" className="mt-4">
              <SkippedItemsList
                workspaceId={activeWorkspaceId || undefined}
                topicId={selectedTopicId || undefined}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
