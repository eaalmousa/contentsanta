import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { format } from "date-fns";
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
  Edit3,
  Save,
  History,
  GitBranch,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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

const editSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Content is required"),
});

type EditFormValues = z.infer<typeof editSchema>;

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

function VersionHistoryItem({ 
  version, 
  isLatest,
  onRestore 
}: { 
  version: AssetVersion; 
  isLatest: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3" data-testid={`version-${version.id}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Version {version.versionNo}</span>
          {isLatest && (
            <Badge variant="secondary" className="text-xs">Latest</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate">
          {version.title || "Untitled"}
        </span>
        <span className="text-xs text-muted-foreground">
          {version.createdAt ? format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
        </span>
      </div>
      {!isLatest && (
        <Button variant="outline" size="sm" onClick={onRestore} data-testid={`button-restore-${version.id}`}>
          Restore
        </Button>
      )}
    </div>
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
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  
  const version = asset?.latestVersion;
  const workflowInfo = version?.workflowType ? workflowMeta[version.workflowType as WorkflowType] : null;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: version?.title || "",
      body: version?.body || "",
    },
  });

  // Fetch version history
  const { data: versions, isLoading: versionsLoading } = useQuery<AssetVersion[]>({
    queryKey: ["/api/assets", asset?.id, "versions"],
    queryFn: async () => {
      if (!asset) return [];
      const res = await fetch(`/api/assets/${asset.id}/versions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!asset && activeTab === "history",
  });

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

  const saveMutation = useMutation({
    mutationFn: async (data: EditFormValues) => {
      if (!asset) return;
      // Create a new version with the updated content
      await apiRequest("POST", `/api/assets/${asset.id}/versions`, {
        title: data.title,
        body: data.body,
        language: version?.language || "en",
        channel: version?.channel || "generic",
        workflowType: version?.workflowType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets", asset?.id, "versions"] });
      setIsEditing(false);
      toast({ title: "Changes saved as new version" });
    },
    onError: () => {
      toast({ title: "Failed to save changes", variant: "destructive" });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionToRestore: AssetVersion) => {
      if (!asset) return;
      await apiRequest("POST", `/api/assets/${asset.id}/versions`, {
        title: versionToRestore.title,
        body: versionToRestore.body,
        language: versionToRestore.language,
        channel: versionToRestore.channel,
        workflowType: versionToRestore.workflowType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets", asset?.id, "versions"] });
      toast({ title: "Version restored" });
    },
  });

  // Reset form when version changes
  const handleStartEdit = () => {
    form.reset({
      title: version?.title || "",
      body: version?.body || "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    form.reset();
    setIsEditing(false);
  };

  if (!asset || !version) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <SheetTitle className="text-xl font-serif truncate" data-testid="text-detail-title">
                {version.title || "Untitled"}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={statusColors[asset.status]}>
                  {asset.status === "in_review" ? "In Review" : asset.status}
                </Badge>
                {workflowInfo && (
                  <Badge variant="outline">{workflowInfo.label}</Badge>
                )}
                <Badge variant="outline" className="text-xs">v{version.versionNo}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="content" data-testid="tab-content">
                <FileText className="mr-2 h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">
                <History className="mr-2 h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="comments" data-testid="tab-comments">
                <MessageSquare className="mr-2 h-4 w-4" />
                Comments
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="content" className="mt-0 p-6 pt-4">
              <div className="flex flex-col gap-6">
                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                  {version.language && (
                    <Badge variant="outline" className="uppercase text-xs">{version.language}</Badge>
                  )}
                  {version.channel && version.channel !== "generic" && (
                    <div className="flex items-center gap-1">
                      <Tag className="h-4 w-4" />
                      <span className="capitalize">{version.channel}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={handleStartEdit} data-testid="button-edit">
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
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

                {/* Content */}
                {isEditing ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="flex flex-col gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="body"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="min-h-[300px] resize-none"
                                data-testid="input-edit-body"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-center gap-2">
                        <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-edit">
                          {saveMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save as New Version
                        </Button>
                        <Button type="button" variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Content</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-sm" data-testid="text-detail-body">
                        {version.body}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0 p-6 pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Version History</h3>
                </div>
                
                {versionsLoading ? (
                  <div className="flex flex-col gap-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : versions && versions.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {versions.map((v, index) => (
                      <VersionHistoryItem 
                        key={v.id} 
                        version={v} 
                        isLatest={index === 0}
                        onRestore={() => restoreVersionMutation.mutate(v)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <History className="h-10 w-10 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No version history available.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comments" className="mt-0 p-6 pt-4">
              <CommentsPanel assetVersionId={version.id} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
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
