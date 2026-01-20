import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronDown, 
  ChevronRight, 
  RefreshCw, 
  Copy, 
  Check,
  AlertCircle,
  Clock,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PublishingTarget, WpPluginRequestLog } from "@shared/schema";

interface PluginDiagnosticsProps {
  target: PublishingTarget;
}

interface PluginLogsResponse {
  logs: WpPluginRequestLog[];
  meta: {
    lastPullAt: string | null;
    health: string;
    siteIdMasked: string | null;
    targetName: string;
  };
}

const REASON_MESSAGES: Record<string, string> = {
  AUTH_SUCCESS: "Authentication successful.",
  AUTH_FAILED: "Authentication failed (signature/timestamp/nonce).",
  SITE_NOT_FOUND: "Site ID not recognized.",
  SECRET_INVALID: "Secret mismatch.",
  JOB_LEASED: "Job locked and sent to plugin.",
  JOB_NONE: "No queued items available.",
  REPORT_SUCCESS: "Publishing result received.",
  REPORT_FAILED: "Publishing report failed.",
  RATE_LIMIT: "Rate limit exceeded.",
  REPLAY_DETECTED: "Replay attack detected.",
  SERVER_ERROR: "Internal server error.",
  HEARTBEAT: "Heartbeat check.",
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function StatusBadge({ status }: { status: number }) {
  const isSuccess = status >= 200 && status < 300;
  const isNoContent = status === 204;
  
  return (
    <Badge 
      variant={isSuccess ? "secondary" : "destructive"}
      className={cn(
        "text-xs font-mono",
        isNoContent && "bg-muted text-muted-foreground"
      )}
      data-testid={`badge-status-${status}`}
    >
      {status}
    </Badge>
  );
}

function LogRow({ log, isExpanded, onToggle }: { 
  log: WpPluginRequestLog; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const createdAt = new Date(log.createdAt || Date.now());
  const isError = log.httpStatus >= 400;
  
  return (
    <div 
      className={cn(
        "border-b last:border-b-0 py-2 px-3",
        isError && "bg-destructive/5"
      )}
      data-testid={`log-row-${log.id}`}
    >
      <div 
        className="flex items-center gap-3 cursor-pointer hover-elevate rounded-sm py-1"
        onClick={onToggle}
      >
        <div className="flex items-center gap-1 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              {formatRelativeTime(createdAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {createdAt.toLocaleString()}
          </TooltipContent>
        </Tooltip>
        
        <Badge variant="outline" className="text-xs font-mono shrink-0">
          {log.endpoint}
        </Badge>
        
        <StatusBadge status={log.httpStatus} />
        
        <span className="text-xs text-muted-foreground shrink-0">
          {log.responseMs}ms
        </span>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "text-xs truncate flex-1",
              isError ? "text-destructive" : "text-foreground"
            )}>
              {REASON_MESSAGES[log.reason] || log.reason}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-mono text-xs">{log.reason}</p>
            <p className="text-xs mt-1">{REASON_MESSAGES[log.reason] || "Unknown reason code"}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {isExpanded && (
        <div className="mt-2 ml-6 p-2 bg-muted/50 rounded text-xs font-mono space-y-1">
          {log.requestSummary && (
            <div>
              <span className="text-muted-foreground">Request: </span>
              <span>{log.requestSummary}</span>
            </div>
          )}
          {log.responseSummary && (
            <div>
              <span className="text-muted-foreground">Response: </span>
              <span>{log.responseSummary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PluginDiagnostics({ target }: PluginDiagnosticsProps) {
  const shouldAutoExpand = target.lastHealthStatus === "fail" || target.lastHealthStatus === "unknown";
  const [isOpen, setIsOpen] = useState(shouldAutoExpand);
  const [filter, setFilter] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shouldAutoExpand && !isOpen) {
      setIsOpen(true);
    }
  }, [shouldAutoExpand]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<PluginLogsResponse>({
    queryKey: ["/api/publishing-targets", target.id, "plugin-logs", filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (filter === "errors") params.set("errorsOnly", "true");
      if (filter === "pull" || filter === "report") params.set("type", filter);
      
      const res = await fetch(`/api/publishing-targets/${target.id}/plugin-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: isOpen,
    refetchInterval: isOpen ? 30000 : false,
  });

  const handleCopyDebugBundle = async () => {
    const bundle = {
      targetId: target.id,
      siteIdMasked: data?.meta?.siteIdMasked,
      targetName: data?.meta?.targetName || target.name,
      health: data?.meta?.health || target.lastHealthStatus,
      lastPullAt: data?.meta?.lastPullAt || target.lastPullAt,
      exportedAt: new Date().toISOString(),
      logs: data?.logs || [],
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between px-2 h-8"
          data-testid="button-toggle-diagnostics"
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-medium">Plugin Diagnostics</span>
            <span className="text-xs text-muted-foreground">(Last 20 requests)</span>
          </div>
          {target.lastHealthStatus === "fail" && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              Issues
            </Badge>
          )}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2">
        <div className="border rounded-md bg-card">
          <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-7 w-[120px] text-xs" data-testid="select-filter">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="errors">Errors only</SelectItem>
                  <SelectItem value="pull">Pulls</SelectItem>
                  <SelectItem value="report">Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh-logs"
              >
                <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={handleCopyDebugBundle}
                disabled={!data}
                data-testid="button-copy-debug-bundle"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Debug
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="p-4 text-center">
                <AlertCircle className="h-6 w-6 mx-auto text-destructive mb-2" />
                <p className="text-sm text-muted-foreground">Failed to load logs</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => refetch()}
                  data-testid="button-retry-logs"
                >
                  Retry
                </Button>
              </div>
            ) : data?.logs.length === 0 ? (
              <div className="p-6 text-center">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No plugin requests logged yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trigger a manual pull from WordPress to generate logs.
                </p>
              </div>
            ) : (
              data?.logs.map(log => (
                <LogRow 
                  key={log.id} 
                  log={log}
                  isExpanded={expandedLogs.has(log.id)}
                  onToggle={() => toggleLogExpanded(log.id)}
                />
              ))
            )}
          </div>
          
          {data?.meta && (
            <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Site: {data.meta.siteIdMasked || "Not connected"}
              </span>
              <span>
                Health: <Badge variant={data.meta.health === "ok" ? "secondary" : "destructive"} className="text-xs ml-1">
                  {data.meta.health}
                </Badge>
              </span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
