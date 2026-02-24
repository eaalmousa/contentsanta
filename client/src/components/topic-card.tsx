import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    MoreVertical,
    Settings,
    Trash2,
    RefreshCw,
    AlertCircle,
    Clock,
    Newspaper,
    Globe,
    BookOpen,
    FileText,
    Shuffle,
    Activity,
    Zap,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTopicRuns } from "@/hooks/use-topic-runs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Topic, ContentIntent } from "@shared/schema";

const contentIntentConfig: Record<ContentIntent, { label: string; icon: any; color: string; gradient: string }> = {
    news_monitoring: { label: "News", icon: Globe, color: "text-blue-500", gradient: "from-blue-500/20 to-blue-600/20 text-blue-500" },
    informational: { label: "Info", icon: BookOpen, color: "text-green-500", gradient: "from-green-500/20 to-emerald-600/20 text-green-500" },
    evergreen: { label: "Evergreen", icon: FileText, color: "text-amber-500", gradient: "from-amber-500/20 to-orange-600/20 text-amber-500" },
    mixed: { label: "Mixed", icon: Shuffle, color: "text-purple-500", gradient: "from-purple-500/20 to-violet-600/20 text-purple-500" },
};

interface TopicStory {
    id: string;
    canonicalTitle: string;
    topicRelevance?: {
        score: number;
        matchedTerms: string[];
    };
}

interface TopicStoriesResponse {
    stories: TopicStory[];
    stats: { relevant: number };
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

// --- Sub-component for Automation Status ---
function AutomationStatusCard({
    topic,
    hasWpPlugin
}: {
    topic: Topic;
    hasWpPlugin: boolean;
}) {
    const { toast } = useToast();

    const { data: activity, isLoading, refetch } = useQuery<AutomationActivity>({
        queryKey: [`/api/topics/${topic.id}/automation-activity`],
        refetchInterval: topic.automationMode !== "manual" ? 30000 : false,
    });

    const runPipelineMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/topics/${topic.id}/run-pipeline`);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Pipeline started", description: "Running automation for this topic" });
            setTimeout(() => refetch(), 2000);
            queryClient.invalidateQueries({ queryKey: [`/api/topics/${topic.id}/automation-activity`] });
        },
        onError: (error: any) => {
            toast({ title: "Pipeline failed", description: error.message, variant: "destructive" });
        },
    });

    if (isLoading) return <div className="h-24 animate-pulse bg-muted/20 rounded-lg" />;

    const stats = activity?.stats;
    const lastRun = activity?.recentRuns?.[0];

    return (
        <div className="mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${topic.automationMode === 'auto' ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">Auto-Pilot</span>
                </div>

                <div className="flex items-center gap-2">
                    {lastRun && (
                        <span className="text-xs text-muted-foreground mr-2">
                            Last run {lastRun.endedAt ? formatDistanceToNow(new Date(lastRun.endedAt), { addSuffix: true }) : 'running...'}
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-background/50 hover:bg-background/80"
                        onClick={() => runPipelineMutation.mutate()}
                        disabled={runPipelineMutation.isPending}
                    >
                        {runPipelineMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3 mr-1" />}
                        Run Now
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-xl font-bold text-foreground">{stats?.todayPublished || 0}</div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Pub Today</div>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-xl font-bold text-blue-500">{stats?.awaitingGate || 0}</div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Pending</div>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <div className="text-xl font-bold text-red-500">{stats?.currentQuarantined || 0}</div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Issues</div>
                </div>
            </div>
        </div>
    );
}

// --- Main Topic Card Component ---
export function TopicCard({
    topic,
    onToggleLive,
    onDelete,
    onOpenSettings,
    onRunDiscovery,
    isPending,
    isDiscoveryPending,
    enabledSourceCount
}: {
    topic: Topic;
    onToggleLive: () => void;
    onDelete: () => void;
    onOpenSettings: () => void;
    onRunDiscovery: () => void;
    isPending: boolean;
    isDiscoveryPending?: boolean;
    enabledSourceCount: number;
}) {
    const [showStories, setShowStories] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // Fetch topic stories
    const { data: storiesData } = useQuery<TopicStoriesResponse>({
        queryKey: ["/api/topics", topic.id, "stories"],
    });

    const topicStories = storiesData?.stories || [];
    const isLive = topic.isLive === "true";

    const { activeJob, hasActiveJob, activeStatus } = useTopicRuns(topic.id, isLive);

    const getStatusDisplay = (status: string) => {
        switch (status) {
            case "queued": return { label: "Queued", color: "bg-blue-500" };
            case "running": return { label: "Running", color: "bg-yellow-500 animate-pulse" };
            case "success": return { label: "Success", color: "bg-green-500" };
            case "fail": return { label: "Failed", color: "bg-red-500" };
            case "timeout": return { label: "Timeout", color: "bg-orange-500" };
            default: return { label: status, color: "bg-gray-500" };
        }
    };

    const intent = contentIntentConfig[topic.contentIntent as ContentIntent] || contentIntentConfig.mixed;
    const IntentIcon = intent.icon;
    const canActivate = enabledSourceCount > 0 || isLive;
    const storiesCount = topicStories.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
            <Card
                className={`
          relative overflow-hidden transition-all duration-300
          ${isLive
                        ? 'border-primary/20 shadow-[0_0_30px_-10px_rgba(var(--primary),0.15)] bg-card/60'
                        : 'border-border/30 bg-card/40 opacity-90'
                    }
        `}
            >
                {/* Animated Glow Border on Active */}
                {isLive && (
                    <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-primary/20" />
                )}

                <CardHeader className="pb-3 relative z-10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className={`p-2.5 rounded-xl bg-gradient-to-br ${intent.gradient} shadow-sm transition-transform duration-300 group-hover:scale-110`}
                            >
                                <IntentIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-semibold tracking-tight text-foreground/90">
                                    {topic.name}
                                </CardTitle>
                                <CardDescription className="text-xs font-medium text-muted-foreground/80 flex items-center gap-1.5 mt-0.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                    {isLive ? 'Active Engine' : 'Engine Paused'}
                                </CardDescription>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 backdrop-blur-xl bg-popover/80">
                                <DropdownMenuItem onClick={onRunDiscovery} disabled={!!(isDiscoveryPending || enabledSourceCount === 0)}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Run Discovery
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onOpenSettings}>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Edit Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>

                <CardContent className="relative z-10">
                    {topic.query && (
                        <div className="mb-4">
                            <div className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider mb-1">Target Keywords</div>
                            <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed bg-muted/20 p-2 rounded-md border border-border/30 font-mono text-xs">
                                {topic.query}
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                                {/* Mock avatars or icons representing sources/language */}
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 border border-background flex items-center justify-center text-[10px] font-bold">
                                    {topic.language?.toUpperCase() || 'EN'}
                                </div>
                            </div>
                            <Badge variant="outline" className="text-xs h-6 bg-background/50 backdrop-blur-sm border-border/40">
                                Sources: {enabledSourceCount}
                            </Badge>
                        </div>

                        <Switch
                            checked={isLive}
                            onCheckedChange={onToggleLive}
                            disabled={isPending || !canActivate}
                            className="data-[state=checked]:bg-green-500"
                        />
                    </div>

                    {/* Active Job Status */}
                    <AnimatePresence>
                        {isLive && hasActiveJob && activeJob && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mb-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusDisplay(activeStatus || "queued").color}`} />
                                    <span className="font-medium animate-pulse">{getStatusDisplay(activeStatus || "queued").label}</span>
                                    {activeJob.processedCount && (
                                        <span className="ml-auto font-mono opacity-80">{activeJob.processedCount} processed</span>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Stats Bar */}
                    <div className="flex items-center gap-2 mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 px-2 text-xs gap-1.5 ${showStories ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setShowStories(!showStories)}
                        >
                            <Newspaper className="w-3.5 h-3.5" />
                            {storiesCount} Stories
                            {storiesCount > 0 && <span className="w-1.5 h-1.5 bg-primary rounded-full ml-0.5" />}
                        </Button>

                        {topic.publishTimes && topic.publishTimes.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto" title="Scheduled Times">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{topic.publishTimes.length}</span>
                            </div>
                        )}
                    </div>

                    {/* Recent Stories Expandable */}
                    <AnimatePresence>
                        {showStories && storiesCount > 0 && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <ScrollArea className="h-40 rounded-lg border border-border/50 bg-background/30 p-2 mb-4">
                                    <div className="space-y-1">
                                        {topicStories.slice(0, 10).map((story) => (
                                            <div key={story.id} className="p-2 rounded hover:bg-muted/50 transition-colors cursor-default text-xs">
                                                <div className="font-medium line-clamp-1">{story.canonicalTitle}</div>
                                                {story.topicRelevance && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary/70"
                                                                style={{ width: `${(story.topicRelevance.score * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-mono text-[10px] text-muted-foreground">
                                                            {(story.topicRelevance.score * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Schedule Info */}
                    <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-medium text-foreground">
                                    {topic.publishFrequency === "realtime" 
                                        ? "Real-time" 
                                        : `${topic.articlesPerDay || 0}/day (${topic.publishFrequency || "auto"})`
                                    }
                                </span>
                            </div>
                            {topic.nextRunAt && (
                                <div className="flex items-center gap-1.5 text-primary">
                                    <Activity className="w-3.5 h-3.5" />
                                    <span>Next: {new Date(topic.nextRunAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            )}
                        </div>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] hover:bg-primary/10 hover:text-primary px-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenSettings();
                            }}
                        >
                            Edit
                        </Button>
                    </div>

                    {/* Automation Panel */}
                    {topic.automationMode && topic.automationMode !== "manual" && (
                        <AutomationStatusCard topic={topic} hasWpPlugin={!!topic.publishingTargetId} />
                    )}

                </CardContent>
            </Card>
        </motion.div>
    );
}
