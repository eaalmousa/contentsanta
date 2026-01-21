import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import type { Topic, PipelineItem } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type PipelineItemWithStory = PipelineItem & {
  story: {
    id: string;
    canonicalTitle: string;
    excerpt: string;
  } | null;
  topicName?: string;
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
  onPublishNow 
}: { 
  item: PipelineItemWithStory;
  onRetry: (id: string) => void;
  onPublishNow: (id: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  
  const canRetry = item.status === "quarantined" || item.status === "retrying";
  const canPublishNow = item.status === "scheduled";
  
  return (
    <>
      <div className="flex items-start gap-3 p-3 border rounded-lg hover-elevate">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={item.status} />
            {item.topicName && (
              <Badge variant="outline" className="text-xs">
                {item.topicName}
              </Badge>
            )}
          </div>
          <h4 className="font-medium text-sm truncate">
            {item.story?.canonicalTitle || "Unknown Story"}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {item.story?.excerpt || "No excerpt available"}
          </p>
          {item.lastErrorMessage && (
            <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
              <span className="font-medium">{item.lastErrorCode}: </span>
              {item.lastErrorMessage}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {(item.retryCount ?? 0) > 0 && (
              <span>Retries: {item.retryCount}/5</span>
            )}
            {item.score && (
              <span>Score: {parseFloat(item.score as any).toFixed(2)}</span>
            )}
            {item.createdAt && (
              <span>Created: {formatDistanceToNow(new Date(item.createdAt))} ago</span>
            )}
            {item.status === "scheduled" && item.scheduledFor && (
              <span className="text-orange-600 font-medium">
                Publishes: {new Date(item.scheduledFor) <= new Date() 
                  ? "Next pipeline run" 
                  : `in ${formatDistanceToNow(new Date(item.scheduledFor))}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => setShowDetails(true)}
            data-testid={`button-view-item-${item.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canPublishNow && (
            <Button 
              size="sm" 
              variant="default"
              onClick={() => onPublishNow(item.id)}
              data-testid={`button-publish-now-${item.id}`}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
          {canRetry && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => onRetry(item.id)}
              data-testid={`button-retry-item-${item.id}`}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pipeline Item Details</DialogTitle>
            <DialogDescription>
              {item.story?.canonicalTitle || "Unknown Story"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div className="mt-1"><StatusBadge status={item.status} /></div>
              </div>
              <div>
                <span className="text-muted-foreground">Score:</span>
                <div className="mt-1 font-medium">{parseFloat(item.score as any || "0").toFixed(3)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Retry Count:</span>
                <div className="mt-1 font-medium">{item.retryCount}/5</div>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <div className="mt-1 font-medium">
                  {item.createdAt ? formatDistanceToNow(new Date(item.createdAt)) + " ago" : "N/A"}
                </div>
              </div>
            </div>
            
            {item.lastErrorMessage && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <h4 className="font-medium text-destructive mb-1">Last Error</h4>
                <p className="text-sm"><strong>{item.lastErrorCode}:</strong> {item.lastErrorMessage}</p>
              </div>
            )}
            
            {item.generatedTitle && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-1">Generated Content</h4>
                <p className="text-sm font-medium">{item.generatedTitle}</p>
                {item.generatedExcerpt && (
                  <p className="text-sm text-muted-foreground mt-1">{item.generatedExcerpt}</p>
                )}
              </div>
            )}
            
            {item.targetPostId && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <h4 className="font-medium text-green-700 dark:text-green-400 mb-1">Published</h4>
                <p className="text-sm">Post ID: {item.targetPostId}</p>
                {item.targetPermalink && (
                  <a 
                    href={item.targetPermalink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    View Post <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            {canRetry && (
              <Button onClick={() => { onRetry(item.id); setShowDetails(false); }}>
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

export default function Pipeline() {
  const { toast } = useToast();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("items");

  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const automatedTopics = topics.filter(t => t.automationMode === "auto" || t.automationMode === "approval_required");

  const { data: pipelineItems = [], isLoading: isLoadingItems } = useQuery<PipelineItemWithStory[]>({
    queryKey: ["/api/topics", selectedTopicId, "pipeline-items"],
    enabled: !!selectedTopicId,
  });

  const { data: quarantinedItems = [], isLoading: isLoadingQuarantine } = useQuery<PipelineItemWithStory[]>({
    queryKey: ["/api/quarantine", { workspaceId: "demo-workspace" }],
  });

  const { data: jobRuns = [] } = useQuery<JobRun[]>({
    queryKey: ["/api/topics", selectedTopicId, "job-runs"],
    enabled: !!selectedTopicId,
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

  const filteredItems = statusFilter === "all" 
    ? pipelineItems 
    : pipelineItems.filter(item => item.status === statusFilter);

  const statusCounts = pipelineItems.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTopicId === topic.id
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
                    ? `${pipelineItems.length} items in pipeline`
                    : "Choose a topic from the list to view pipeline items"}
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
                    <TabsTrigger value="items" data-testid="tab-items">Items</TabsTrigger>
                    <TabsTrigger value="history" data-testid="tab-history">Job History</TabsTrigger>
                  </TabsList>
                  
                  {activeTab === "items" && (
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
                    {isLoadingItems ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredItems.length > 0 ? (
                      <div className="space-y-2">
                        {filteredItems.map((item) => (
                          <PipelineItemCard
                            key={item.id}
                            item={item}
                            onRetry={(id) => retryItemMutation.mutate(id)}
                            onPublishNow={(id) => publishNowMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-12">
                        No pipeline items found
                        {statusFilter !== "all" && ` with status "${statusFilter}"`}
                      </p>
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
                <AlertCircle className="h-5 w-5 text-destructive" />
                Quarantine
              </CardTitle>
              <CardDescription>
                Items that failed after maximum retries and need attention
              </CardDescription>
            </div>
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {quarantinedItems.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingQuarantine ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quarantinedItems.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {quarantinedItems.map((item) => (
                  <PipelineItemCard
                    key={item.id}
                    item={item}
                    onRetry={(id) => retryItemMutation.mutate(id)}
                    onPublishNow={(id) => publishNowMutation.mutate(id)}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
              <p>No quarantined items - all clear!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
