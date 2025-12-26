import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Filter,
  Plus,
  FileText,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Asset, AssetStatus, WorkflowType } from "@shared/schema";
import { workflowMeta } from "@shared/schema";

const statusOptions: { value: AssetStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const workflowOptions = Object.entries(workflowMeta).map(([key, meta]) => ({
  value: key,
  label: meta.label,
}));

function AssetCard({ asset }: { asset: Asset }) {
  const statusColors: Record<AssetStatus, string> = {
    draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    published: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };

  const workflowInfo = asset.workflowType ? workflowMeta[asset.workflowType as WorkflowType] : null;

  return (
    <Card className="group" data-testid={`card-asset-${asset.id}`}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h3 className="font-medium truncate" data-testid={`text-asset-title-${asset.id}`}>
                  {asset.title}
                </h3>
                {workflowInfo && (
                  <span className="text-xs text-muted-foreground">
                    {workflowInfo.label}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-asset-menu-${asset.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Body Preview */}
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {asset.body?.slice(0, 200)}
            {asset.body && asset.body.length > 200 ? "..." : ""}
          </p>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={statusColors[asset.status]}>
                {asset.status}
              </Badge>
              {asset.language && (
                <Badge variant="outline" className="uppercase text-xs">
                  {asset.language}
                </Badge>
              )}
              {asset.channelType && (
                <Badge variant="outline" className="text-xs">
                  {asset.channelType}
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

export default function ContentLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["/api/assets", { status: statusFilter, workflow: workflowFilter, search: searchQuery }],
    staleTime: 0, // Always consider data stale so it refetches on mount
    refetchOnMount: "always", // Always refetch when component mounts
  });

  const filteredAssets = assets?.filter((asset) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!asset.title.toLowerCase().includes(query) && 
          !asset.body?.toLowerCase().includes(query)) {
        return false;
      }
    }
    if (statusFilter !== "all" && asset.status !== statusFilter) {
      return false;
    }
    if (workflowFilter !== "all" && asset.workflowType !== workflowFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
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

      {/* Filters */}
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

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredAssets && filteredAssets.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
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
    </div>
  );
}
