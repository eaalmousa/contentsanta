import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Globe,
  MoreHorizontal,
  Edit,
  Trash2,
  CheckCircle,
  Loader2,
  Send,
  ExternalLink,
  RefreshCw,
  Tag,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Search,
  AlertCircle,
} from "lucide-react";
import { SiWordpress, SiMedium, SiLinkedin, SiFacebook } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PublishingTarget, PublishJob, Asset, AssetVersion, TargetType, WpTaxonomyCache } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

const platformOptions: { value: TargetType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "wordpress", label: "WordPress", icon: SiWordpress, color: "text-blue-600" },
  { value: "webflow", label: "Webflow", icon: Globe, color: "text-blue-500" },
  { value: "linkedin", label: "LinkedIn", icon: SiLinkedin, color: "text-blue-700" },
  { value: "x", label: "X (Twitter)", icon: Globe, color: "text-gray-800 dark:text-gray-200" },
  { value: "meta", label: "Meta (Facebook/Instagram)", icon: SiFacebook, color: "text-blue-600" },
  { value: "email", label: "Email Newsletter", icon: Globe, color: "text-muted-foreground" },
  { value: "custom", label: "Custom Webhook", icon: Globe, color: "text-muted-foreground" },
];

const targetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Platform is required"),
  configJson: z.object({
    apiUrl: z.string().url("Valid URL required").optional().or(z.literal("")),
    apiKey: z.string().optional(),
    username: z.string().optional(),
  }),
});

type TargetFormValues = z.infer<typeof targetSchema>;

type AssetWithVersion = Asset & {
  latestVersion?: AssetVersion;
};

function PlatformIcon({ type, className }: { type: string; className?: string }) {
  const option = platformOptions.find((p) => p.value === type);
  if (!option) return <Globe className={className} />;
  const Icon = option.icon;
  return <Icon className={`${className} ${option.color}`} />;
}

function TargetCard({ target, onEdit }: { target: PublishingTarget; onEdit: () => void }) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/publishing-targets/${target.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", { workspaceId: "demo-workspace" }] });
      toast({ title: "Target deleted" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${target.id}/test`);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ 
          title: "Connection successful", 
          description: `Connected to ${data.siteName || target.name}` 
        });
      } else {
        toast({ 
          title: "Connection failed", 
          description: data.error || "Could not connect to the target",
          variant: "destructive" 
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Connection test failed", 
        variant: "destructive" 
      });
    },
  });

  const testDraftMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${target.id}/test-post`);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ 
          title: "Test draft created", 
          description: "A test draft has been created in your WordPress"
        });
      } else {
        toast({ 
          title: "Failed to create test draft", 
          description: data.error || "Could not create test post",
          variant: "destructive" 
        });
      }
    },
    onError: () => {
      toast({ 
        title: "Test draft failed", 
        variant: "destructive" 
      });
    },
  });

  const platformInfo = platformOptions.find((p) => p.value === target.type);
  const isWordPress = target.type === "wordpress";
  const isTesting = testConnectionMutation.isPending || testDraftMutation.isPending;

  return (
    <Card data-testid={`card-target-${target.id}`}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <PlatformIcon type={target.type} className="h-6 w-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-medium" data-testid={`text-target-name-${target.id}`}>
                  {target.name}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {platformInfo?.label || target.type}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Active</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid={`button-target-menu-${target.id}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate()}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {isWordPress && (
            <>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => testConnectionMutation.mutate()}
                  disabled={isTesting}
                  data-testid={`button-test-connection-${target.id}`}
                >
                  {testConnectionMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-3 w-3" />
                  )}
                  Test Connection
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => testDraftMutation.mutate()}
                  disabled={isTesting}
                  data-testid={`button-test-draft-${target.id}`}
                >
                  {testDraftMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-3 w-3" />
                  )}
                  Create Test Draft
                </Button>
              </div>
              <TaxonomySyncSection targetId={target.id} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TargetCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TaxonomyItem extends WpTaxonomyCache {
  children?: TaxonomyItem[];
}

function buildCategoryTree(categories: WpTaxonomyCache[]): TaxonomyItem[] {
  const map = new Map<number, TaxonomyItem>();
  const roots: TaxonomyItem[] = [];
  
  categories.forEach(cat => {
    map.set(cat.wpId, { ...cat, children: [] });
  });
  
  categories.forEach(cat => {
    const node = map.get(cat.wpId)!;
    if (cat.parentWpId && map.has(cat.parentWpId)) {
      map.get(cat.parentWpId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
}

function CategoryTreeItem({ item, level = 0 }: { item: TaxonomyItem; level?: number }) {
  const [expanded, setExpanded] = useState(level === 0);
  const hasChildren = item.children && item.children.length > 0;
  
  return (
    <div>
      <div 
        className="flex items-center gap-1 py-1 hover-elevate rounded cursor-pointer"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-sm">{item.name}</span>
        <Badge variant="outline" className="ml-auto text-xs">
          {item.count}
        </Badge>
      </div>
      {expanded && hasChildren && (
        <div>
          {item.children!.map(child => (
            <CategoryTreeItem key={child.wpId} item={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaxonomySyncSection({ targetId }: { targetId: string }) {
  const { toast } = useToast();
  const [tagSearch, setTagSearch] = useState("");
  
  const taxonomyQuery = useQuery<{ 
    items: WpTaxonomyCache[]; 
    lastSync: { categories: string | null; tags: string | null } 
  }>({
    queryKey: ["/api/publishing-targets", targetId, "taxonomy"],
  });
  
  const syncCategoriesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${targetId}/sync-categories`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", targetId, "taxonomy"] });
      toast({ title: "Categories synced", description: `${data.count} categories imported` });
    },
    onError: () => {
      toast({ title: "Failed to sync categories", variant: "destructive" });
    },
  });
  
  const syncTagsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${targetId}/sync-tags`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", targetId, "taxonomy"] });
      toast({ title: "Tags synced", description: `${data.count} tags imported` });
    },
    onError: () => {
      toast({ title: "Failed to sync tags", variant: "destructive" });
    },
  });
  
  const categories = taxonomyQuery.data?.items.filter(i => i.taxonomyType === "category") || [];
  const tags = taxonomyQuery.data?.items.filter(i => i.taxonomyType === "tag") || [];
  const categoryTree = buildCategoryTree(categories);
  
  const filteredTags = tagSearch 
    ? tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : tags;
  
  const lastCategorySync = taxonomyQuery.data?.lastSync?.categories;
  const lastTagSync = taxonomyQuery.data?.lastSync?.tags;
  
  return (
    <div className="flex flex-col gap-4 pt-4 border-t">
      <div className="flex items-center gap-2">
        <FolderTree className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">WordPress Taxonomy</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Categories</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => syncCategoriesMutation.mutate()}
              disabled={syncCategoriesMutation.isPending}
              data-testid={`button-sync-categories-${targetId}`}
            >
              {syncCategoriesMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span className="ml-1">Sync</span>
            </Button>
          </div>
          {lastCategorySync && (
            <span className="text-xs text-muted-foreground">
              Last synced {formatDistanceToNow(new Date(lastCategorySync), { addSuffix: true })}
            </span>
          )}
          <ScrollArea className="h-32 rounded border p-2">
            {categories.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">
                No categories synced. Click Sync to fetch.
              </div>
            ) : (
              categoryTree.map(cat => (
                <CategoryTreeItem key={cat.wpId} item={cat} />
              ))
            )}
          </ScrollArea>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Tags</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => syncTagsMutation.mutate()}
              disabled={syncTagsMutation.isPending}
              data-testid={`button-sync-tags-${targetId}`}
            >
              {syncTagsMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span className="ml-1">Sync</span>
            </Button>
          </div>
          {lastTagSync && (
            <span className="text-xs text-muted-foreground">
              Last synced {formatDistanceToNow(new Date(lastTagSync), { addSuffix: true })}
            </span>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input 
              placeholder="Search tags..." 
              className="h-7 pl-7 text-xs"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              data-testid={`input-search-tags-${targetId}`}
            />
          </div>
          <ScrollArea className="h-24 rounded border p-2">
            {tags.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">
                No tags synced. Click Sync to fetch.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {filteredTags.slice(0, 50).map(tag => (
                  <Badge key={tag.wpId} variant="secondary" className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
                {filteredTags.length > 50 && (
                  <span className="text-xs text-muted-foreground">
                    +{filteredTags.length - 50} more
                  </span>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function CreateTargetDialog({ 
  open, 
  onOpenChange, 
  editTarget 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  editTarget?: PublishingTarget | null;
}) {
  const { toast } = useToast();
  const isEditing = !!editTarget;

  const form = useForm<TargetFormValues>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      name: editTarget?.name || "",
      type: editTarget?.type || "",
      configJson: {
        apiUrl: (editTarget?.configJson as any)?.apiUrl || "",
        apiKey: (editTarget?.configJson as any)?.apiKey || "",
        username: (editTarget?.configJson as any)?.username || "",
      },
    },
  });

  const selectedType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: TargetFormValues) => {
      if (isEditing) {
        await apiRequest("PATCH", `/api/publishing-targets/${editTarget.id}`, data);
      } else {
        await apiRequest("POST", "/api/publishing-targets", {
          ...data,
          workspaceId: "demo-workspace",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", { workspaceId: "demo-workspace" }] });
      toast({ title: isEditing ? "Target updated" : "Target connected" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to save target", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Publishing Target" : "Connect Publishing Target"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update your connection settings." : "Connect a platform to publish your content."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-target-platform">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {platformOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className={`h-4 w-4 ${option.color}`} />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Blog" {...field} data-testid="input-target-name" />
                  </FormControl>
                  <FormDescription>A friendly name for this connection</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {(selectedType === "wordpress" || selectedType === "webflow" || selectedType === "custom") && (
              <FormField
                control={form.control}
                name="configJson.apiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedType === "wordpress" ? "Site URL" : "API URL"}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={selectedType === "wordpress" ? "https://yourblog.com" : "https://api.example.com/webhook"} 
                        {...field} 
                        data-testid="input-target-url"
                      />
                    </FormControl>
                    {selectedType === "wordpress" && (
                      <FormDescription>
                        Your WordPress site URL (without /wp-json)
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedType === "wordpress" && (
              <FormField
                control={form.control}
                name="configJson.username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WordPress Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Your WordPress username" 
                        {...field} 
                        data-testid="input-target-username"
                      />
                    </FormControl>
                    <FormDescription>
                      The username you use to log into WordPress
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(selectedType === "wordpress" || selectedType === "webflow" || selectedType === "custom") && (
              <FormField
                control={form.control}
                name="configJson.apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedType === "wordpress" ? "Application Password" : "API Key / Token"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder={selectedType === "wordpress" ? "xxxx xxxx xxxx xxxx xxxx xxxx" : "Your API key or access token"} 
                        {...field} 
                        data-testid="input-target-apikey"
                      />
                    </FormControl>
                    {selectedType === "wordpress" && (
                      <FormDescription>
                        Generate in WordPress → Users → Profile → Application Passwords
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(selectedType === "x" || selectedType === "linkedin" || selectedType === "meta") && (
              <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                Social media publishing requires OAuth authentication. After saving, you'll be redirected to authorize the connection.
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-target">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PublishDialog({ 
  open, 
  onOpenChange, 
  asset 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  asset: AssetWithVersion | null;
}) {
  const { toast } = useToast();
  const [selectedTarget, setSelectedTarget] = useState<string>("");

  const { data: targets } = useQuery<PublishingTarget[]>({
    queryKey: ["/api/publishing-targets", { workspaceId: "demo-workspace" }],
    queryFn: () => fetch("/api/publishing-targets?workspaceId=demo-workspace").then(r => r.json()),
  });
  
  const safeDialogTargets = targets ?? [];

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!asset || !selectedTarget) return;
      await apiRequest("POST", "/api/publish-jobs", {
        assetVersionId: asset.latestVersion?.id,
        targetId: selectedTarget,
        status: "queued",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publish-jobs"] });
      toast({ title: "Content queued for publishing" });
      onOpenChange(false);
      setSelectedTarget("");
    },
    onError: () => {
      toast({ title: "Failed to publish", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Content</DialogTitle>
          <DialogDescription>
            Select a destination to publish "{asset?.latestVersion?.title}"
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          {safeDialogTargets.length > 0 ? (
            <div className="flex flex-col gap-2">
              {safeDialogTargets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => setSelectedTarget(target.id)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selectedTarget === target.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  data-testid={`button-select-target-${target.id}`}
                >
                  <PlatformIcon type={target.type} className="h-5 w-5" />
                  <span className="font-medium">{target.name}</span>
                  {selectedTarget === target.id && (
                    <CheckCircle className="ml-auto h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Globe className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No publishing targets connected yet.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => publishMutation.mutate()} 
            disabled={!selectedTarget || publishMutation.isPending}
            data-testid="button-confirm-publish"
          >
            {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishJobCard({ job }: { job: PublishJob & { target?: PublishingTarget } }) {
  const statusColors: Record<string, string> = {
    queued: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    succeeded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const resultJson = job.resultJson as { publishedUrl?: string } | null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <PlatformIcon type={job.target?.type || ""} className="h-5 w-5" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{job.target?.name || "Unknown Target"}</span>
          <span className="text-xs text-muted-foreground">
            {job.createdAt ? new Date(job.createdAt).toLocaleString() : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={statusColors[job.status] || ""}>
          {job.status}
        </Badge>
        {resultJson?.publishedUrl && (
          <a href={resultJson.publishedUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function ApprovedAssetCard({ 
  asset, 
  onPublish 
}: { 
  asset: AssetWithVersion; 
  onPublish: () => void;
}) {
  return (
    <Card data-testid={`card-approved-asset-${asset.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h4 className="font-medium truncate">{asset.latestVersion?.title || "Untitled"}</h4>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {asset.latestVersion?.body?.slice(0, 100)}...
            </p>
          </div>
          <Button size="sm" onClick={onPublish} data-testid={`button-publish-asset-${asset.id}`}>
            <Send className="mr-2 h-4 w-4" />
            Publish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Publishing() {
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PublishingTarget | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetWithVersion | null>(null);

  const { data: targets, isLoading: targetsLoading, isError: targetsError } = useQuery<PublishingTarget[]>({
    queryKey: ["/api/publishing-targets", { workspaceId: "demo-workspace" }],
    queryFn: () => fetch("/api/publishing-targets?workspaceId=demo-workspace").then(r => r.json()),
  });

  const { data: jobs, isLoading: jobsLoading, isError: jobsError } = useQuery<(PublishJob & { target?: PublishingTarget })[]>({
    queryKey: ["/api/publish-jobs"],
  });

  const { data: assets, isLoading: assetsLoading, isError: assetsError } = useQuery<AssetWithVersion[]>({
    queryKey: ["/api/assets", { status: "approved" }],
  });
  
  // Safe arrays to prevent crash on undefined
  const safeTargets = targets ?? [];
  const safeJobs = jobs ?? [];
  const safeAssets = assets ?? [];

  const handleEdit = (target: PublishingTarget) => {
    setEditTarget(target);
    setTargetDialogOpen(true);
  };

  const handleTargetDialogChange = (open: boolean) => {
    setTargetDialogOpen(open);
    if (!open) setEditTarget(null);
  };

  const handlePublish = (asset: AssetWithVersion) => {
    setSelectedAsset(asset);
    setPublishDialogOpen(true);
  };

  const approvedAssets = safeAssets.filter((a) => a.status === "approved");

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-bold" data-testid="text-publishing-title">
          Publishing
        </h1>
        <p className="text-muted-foreground">
          Connect publishing targets and distribute your approved content.
        </p>
      </div>

      <Tabs defaultValue="targets" className="w-full">
        <TabsList>
          <TabsTrigger value="targets" data-testid="tab-targets">Connected Targets</TabsTrigger>
          <TabsTrigger value="ready" data-testid="tab-ready">Ready to Publish</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Publish History</TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="mt-6">
          <div className="flex flex-col gap-6">
            <div className="flex justify-end">
              <Button onClick={() => setTargetDialogOpen(true)} data-testid="button-add-target">
                <Plus className="mr-2 h-4 w-4" />
                Add Target
              </Button>
            </div>

            {targetsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <TargetCardSkeleton key={i} />
                ))}
              </div>
            ) : targetsError ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
                <AlertCircle className="h-16 w-16 text-destructive/50" />
                <div className="flex flex-col items-center gap-2 text-center">
                  <h3 className="font-serif text-xl font-semibold">Failed to load targets</h3>
                  <p className="max-w-sm text-muted-foreground">
                    There was an error loading publishing targets. Please try again.
                  </p>
                </div>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Refresh Page
                </Button>
              </div>
            ) : safeTargets.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {safeTargets.map((target) => (
                  <TargetCard 
                    key={target.id} 
                    target={target} 
                    onEdit={() => handleEdit(target)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
                <Globe className="h-16 w-16 text-muted-foreground/50" />
                <div className="flex flex-col items-center gap-2 text-center">
                  <h3 className="font-serif text-xl font-semibold">No targets connected</h3>
                  <p className="max-w-sm text-muted-foreground">
                    Connect your first publishing target to start distributing content.
                  </p>
                </div>
                <Button onClick={() => setTargetDialogOpen(true)} data-testid="button-add-first-target">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Target
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ready" className="mt-6">
          {assetsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : approvedAssets.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {approvedAssets.map((asset) => (
                <ApprovedAssetCard 
                  key={asset.id} 
                  asset={asset} 
                  onPublish={() => handlePublish(asset)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
              <CheckCircle className="h-16 w-16 text-muted-foreground/50" />
              <div className="flex flex-col items-center gap-2 text-center">
                <h3 className="font-serif text-xl font-semibold">No approved content</h3>
                <p className="max-w-sm text-muted-foreground">
                  Approve content from your library to see it here ready for publishing.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {jobsLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : safeJobs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {safeJobs.map((job) => (
                <PublishJobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
              <Send className="h-16 w-16 text-muted-foreground/50" />
              <div className="flex flex-col items-center gap-2 text-center">
                <h3 className="font-serif text-xl font-semibold">No publish history</h3>
                <p className="max-w-sm text-muted-foreground">
                  Your publishing activity will appear here.
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTargetDialog 
        open={targetDialogOpen} 
        onOpenChange={handleTargetDialogChange}
        editTarget={editTarget}
      />

      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        asset={selectedAsset}
      />
    </div>
  );
}
