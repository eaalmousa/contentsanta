import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Plus,
  FileText,
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
  X,
  MessageSquare,
  Clock,
  Tag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CommentsPanel } from "@/components/comments-panel";
import type { Asset, AssetVersion, AssetStatus, WorkflowType } from "@shared/schema";
import { workflowMeta } from "@shared/schema";

type AssetWithVersion = Asset & {
  latestVersion?: AssetVersion;
};

const statusOptions: { value: AssetStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const statusColors: Record<AssetStatus, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  published: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const workflowOptions = Object.entries(workflowMeta).map(([key, meta]) => ({
  value: key,
  label: meta.label,
}));

function AssetCard({ 
  asset, 
  onViewDetails 
}: { 
  asset: AssetWithVersion; 
  onViewDetails: () => void;
}) {
  const { toast } = useToast();

  const version = asset.latestVersion;
  const workflowInfo = version?.workflowType ? workflowMeta[version.workflowType as WorkflowType] : null;

  const approveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/assets/${asset.id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Asset approved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/assets/${asset.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Asset deleted" });
    },
  });

  const handleExport = () => {
    if (version) {
      window.open(`/api/export/${version.id}?format=md`, "_blank");
    }
  };

  return (
    <Card className="group hover-elevate cursor-pointer" data-testid={`card-asset-${asset.id}`} onClick={onViewDetails}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h3 className="font-medium truncate" data-testid={`text-asset-title-${asset.id}`}>
                  {version?.title || "Untitled"}
                </h3>
                {workflowInfo && (
                  <span className="text-xs text-muted-foreground">
                    {workflowInfo.label}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" data-testid={`button-asset-menu-${asset.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExport(); }}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
                {asset.status === "draft" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); approveMutation.mutate(); }}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(); }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="line-clamp-3 text-sm text-muted-foreground">
            {version?.body?.slice(0, 200)}
            {version?.body && version.body.length > 200 ? "..." : ""}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={statusColors[asset.status]}>
                {asset.status === "in_review" ? "In Review" : asset.status}
              </Badge>
              {version?.language && (
                <Badge variant="outline" className="uppercase text-xs">
                  {version.language}
                </Badge>
              )}
              {version?.channel && version.channel !== "generic" && (
                <Badge variant="outline" className="text-xs">
                  {version.channel}
                </Badge>
              )}
              {version && (
                <Badge variant="outline" className="text-xs">
                  v{version.versionNo}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetDetailSheet({ 
  asset, 
  open, 
  onOpenChange 
}: { 
  asset: AssetWithVersion | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const version = asset?.latestVersion;
  const workflowInfo = version?.workflowType ? workflowMeta[version.workflowType as WorkflowType] : null;

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      await apiRequest("POST", `/api/assets/${asset.id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Asset approved" });
    },
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      await apiRequest("PATCH", `/api/assets/${asset.id}`, { status: "in_review" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Submitted for review" });
    },
  });

  if (!asset || !version) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className="text-xl font-serif" data-testid="text-detail-title">
              {version.title || "Untitled"}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="flex flex-col gap-6 py-6">
            {/* Status and metadata */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={statusColors[asset.status]}>
                {asset.status === "in_review" ? "In Review" : asset.status}
              </Badge>
              {workflowInfo && (
                <Badge variant="outline">
                  {workflowInfo.label}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                v{version.versionNo}
              </Badge>
              {version.language && (
                <Badge variant="outline" className="uppercase text-xs">
                  {version.language}
                </Badge>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}</span>
              </div>
              {version.channel && version.channel !== "generic" && (
                <div className="flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  <span className="capitalize">{version.channel}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {asset.status === "draft" && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => submitForReviewMutation.mutate()}
                    data-testid="button-submit-review"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Submit for Review
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => approveMutation.mutate()}
                    data-testid="button-approve-detail"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </>
              )}
              {asset.status === "in_review" && (
                <Button 
                  size="sm"
                  onClick={() => approveMutation.mutate()}
                  data-testid="button-approve-detail"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`/api/export/${version.id}?format=md`, "_blank")}
                data-testid="button-export-detail"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            <Separator />

            {/* Content body */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">Content</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm" data-testid="text-detail-body">
                  {version.body}
                </div>
              </div>
            </div>

            <Separator />

            {/* Comments section */}
            <CommentsPanel assetVersionId={version.id} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function ContentLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<AssetWithVersion | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: assets, isLoading } = useQuery<AssetWithVersion[]>({
    queryKey: ["/api/assets", { status: statusFilter !== "all" ? statusFilter : undefined }],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const filteredAssets = assets?.filter((asset) => {
    const version = asset.latestVersion;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = version?.title?.toLowerCase() || "";
      const body = version?.body?.toLowerCase() || "";
      if (!title.includes(query) && !body.includes(query)) {
        return false;
      }
    }
    
    if (statusFilter !== "all" && asset.status !== statusFilter) {
      return false;
    }
    
    if (workflowFilter !== "all" && version?.workflowType !== workflowFilter) {
      return false;
    }
    
    return true;
  });

  const handleViewDetails = (asset: AssetWithVersion) => {
    setSelectedAsset(asset);
    setDetailOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl font-bold" data-testid="text-library-title">
            Content Library
          </h1>
          <p className="text-muted-foreground">
            Browse and manage all your generated content assets.
          </p>
        </div>
        <Link href="/create">
          <Button data-testid="button-create-content">
            <Plus className="mr-2 h-4 w-4" />
            Create Content
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-content"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssetStatus | "all")}>
            <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-workflow-filter">
              <SelectValue placeholder="Workflow Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {workflowOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredAssets && filteredAssets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              onViewDetails={() => handleViewDetails(asset)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
          <FileText className="h-16 w-16 text-muted-foreground/50" />
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="font-serif text-xl font-semibold">No content found</h3>
            <p className="max-w-sm text-muted-foreground">
              {searchQuery || statusFilter !== "all" || workflowFilter !== "all"
                ? "Try adjusting your filters or search query."
                : "Create your first piece of content to get started."}
            </p>
          </div>
          <Link href="/create">
            <Button data-testid="button-create-first">
              <Plus className="mr-2 h-4 w-4" />
              Create Content
            </Button>
          </Link>
        </div>
      )}

      <AssetDetailSheet 
        asset={selectedAsset} 
        open={detailOpen} 
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
