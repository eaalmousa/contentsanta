import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Inbox as InboxIcon,
  ExternalLink,
  Sparkles,
  Archive,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  Rss,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SourceItem, Source } from "@shared/schema";
import { workflowMeta, workflowTypes, type WorkflowType } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function InboxPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const { toast } = useToast();

  const buildSourceItemsUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.append("status", statusFilter);
    if (sourceFilter !== "all") params.append("sourceId", sourceFilter);
    const queryString = params.toString();
    return queryString ? `/api/source-items?${queryString}` : "/api/source-items";
  };

  const { data: items, isLoading } = useQuery<SourceItem[]>({
    queryKey: [buildSourceItemsUrl()],
  });

  const { data: sources } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const invalidateItems = () => {
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/source-items")
    });
  };

  const generateMutation = useMutation({
    mutationFn: async ({ itemId, workflowType }: { itemId: string; workflowType: WorkflowType }) =>
      apiRequest("POST", `/api/source-items/${itemId}/generate`, { workflowType }),
    onSuccess: () => {
      invalidateItems();
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "Content generation started",
        description: "Check the Content Library for the generated draft",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/source-items/${id}`, { status }),
    onSuccess: () => {
      invalidateItems();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "default";
      case "queued":
        return "secondary";
      case "processed":
        return "outline";
      case "ignored":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getSourceName = (sourceId: string) => {
    return sources?.find((s) => s.id === sourceId)?.name || "Unknown Source";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const newCount = items?.filter((i) => i.status === "new").length || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Content Inbox
            {newCount > 0 && (
              <Badge variant="default" className="ml-2">
                {newCount} new
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Review and process discovered content from your sources</p>
        </div>
        <Link href="/sources">
          <Button variant="outline" data-testid="button-manage-sources">
            <Rss className="mr-2 h-4 w-4" />
            Manage Sources
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="queued">Processing</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48" data-testid="select-source-filter">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources?.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!items || items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <InboxIcon className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <h3 className="font-medium">No items in inbox</h3>
              <p className="text-sm text-muted-foreground">
                {sources?.length ? "Fetch your sources to discover new content" : "Add sources to start discovering content"}
              </p>
            </div>
            <Link href="/sources">
              <Button data-testid="button-go-to-sources">
                <Rss className="mr-2 h-4 w-4" />
                {sources?.length ? "Fetch Sources" : "Add Sources"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id} className="hover-elevate" data-testid={`card-item-${item.id}`}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer nofollow" 
                      referrerPolicy="no-referrer"
                      className="font-medium text-sm leading-tight line-clamp-2 hover:underline"
                      data-testid={`link-item-${item.id}`}
                    >
                      {item.title}
                    </a>
                    <Badge variant={getStatusColor(item.status)} className="shrink-0 text-xs">
                      {item.status}
                    </Badge>
                  </div>
                  {item.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.excerpt}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Rss className="h-3 w-3" />
                      {getSourceName(item.sourceId)}
                    </span>
                    {item.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                      </span>
                    )}
                    {item.author && <span>by {item.author}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.status === "new" && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            disabled={generateMutation.isPending}
                            data-testid={`button-generate-${item.id}`}
                          >
                            {generateMutation.isPending ? (
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-3 w-3" />
                            )}
                            Generate
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {workflowTypes.slice(0, 6).map((type) => (
                            <DropdownMenuItem
                              key={type}
                              onClick={() => generateMutation.mutate({ itemId: item.id, workflowType: type })}
                            >
                              {workflowMeta[type].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateStatusMutation.mutate({ id: item.id, status: "ignored" })}
                        data-testid={`button-ignore-${item.id}`}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {item.status === "processed" && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {item.status === "ignored" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ id: item.id, status: "new" })}
                      data-testid={`button-restore-${item.id}`}
                    >
                      Restore
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
                    data-testid={`button-open-${item.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
