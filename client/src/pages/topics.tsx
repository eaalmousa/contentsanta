import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspaceContext } from "@/hooks/use-workspace-context";
import { 
  Plus,
  Power,
  PowerOff,
  Settings,
  Trash2,
  MoreVertical,
  Globe,
  BookOpen,
  FileText,
  Shuffle,
  Clock,
  Loader2,
  FolderTree,
  Tag,
  MapPin,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Check,
  Newspaper,
  CheckCircle2,
  Circle,
  Star,
  AlertCircle,
  Play,
  History,
  Eye,
  Copy,
  ExternalLink,
  Zap,
  Shield,
  Pause,
  Rss,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Topic, ContentIntent, WpTaxonomyCache, PublishingTarget, TopicTaxonomyRules } from "@shared/schema";
import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";

const contentIntentConfig: Record<ContentIntent, { label: string; icon: any; color: string }> = {
  news_monitoring: { label: "News", icon: Globe, color: "bg-blue-500" },
  informational: { label: "Info", icon: BookOpen, color: "bg-green-500" },
  evergreen: { label: "Evergreen", icon: FileText, color: "bg-amber-500" },
  mixed: { label: "Mixed", icon: Shuffle, color: "bg-purple-500" },
};

interface TaxonomyCacheItem extends WpTaxonomyCache {
  children?: TaxonomyCacheItem[];
}

function buildCategoryTree(categories: WpTaxonomyCache[]): TaxonomyCacheItem[] {
  const map = new Map<number, TaxonomyCacheItem>();
  const roots: TaxonomyCacheItem[] = [];
  
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

function CategoryTreeSelect({ 
  item, 
  level = 0,
  selectedIds,
  onToggle
}: { 
  item: TaxonomyCacheItem; 
  level?: number;
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(level === 0);
  const hasChildren = item.children && item.children.length > 0;
  const isSelected = selectedIds.includes(item.wpId);
  
  return (
    <div>
      <div 
        className="flex items-center gap-2 py-1 hover-elevate rounded cursor-pointer pr-2"
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        <div 
          className="flex items-center gap-1"
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
        </div>
        <Checkbox 
          checked={isSelected}
          onCheckedChange={() => onToggle(item.wpId)}
          data-testid={`checkbox-category-${item.wpId}`}
        />
        <span className="text-sm flex-1" onClick={() => onToggle(item.wpId)}>{item.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {item.children!.map(child => (
            <CategoryTreeSelect 
              key={child.wpId} 
              item={child} 
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TopicSourceWithDetails {
  topicId: string;
  sourceId: string;
  isEnabled: boolean;
  source: {
    id: string;
    name: string;
    feedUrl: string;
    domain?: string;
    tier?: number;
    language?: string;
  } | null;
}

function TopicSettingsDialog({ 
  topic,
  open,
  onOpenChange
}: { 
  topic: Topic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { activeWorkspaceId, isLoading: isWorkspaceLoading } = useWorkspaceContext();
  const [activeTab, setActiveTab] = useState("sources");
  
  // Block dialog content until workspace context is loaded
  if (isWorkspaceLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading workspace...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  const [publishingTargetId, setPublishingTargetId] = useState<string | null>(topic.publishingTargetId || null);
  const [tagSearch, setTagSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  
  const currentRules = topic.taxonomyRules as TopicTaxonomyRules || {};
  const [rules, setRules] = useState<TopicTaxonomyRules>(currentRules);
  
  const [timezone, setTimezone] = useState(topic.timezone || "UTC");
  const [publishTimes, setPublishTimes] = useState<string[]>((topic.publishTimes as string[] | null) || []);
  const [articlesPerRun, setArticlesPerRun] = useState(topic.articlesPerRun || 3);
  const [runIntervalMinutes, setRunIntervalMinutes] = useState(topic.runIntervalMinutes || 5);
  const [newPublishTime, setNewPublishTime] = useState("14:30");
  
  const commonTimezones = [
    { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
    { value: "Asia/Riyadh", label: "Riyadh (GMT+3)" },
    { value: "Asia/Qatar", label: "Qatar (GMT+3)" },
    { value: "Asia/Kuwait", label: "Kuwait (GMT+3)" },
    { value: "Asia/Bahrain", label: "Bahrain (GMT+3)" },
    { value: "Africa/Cairo", label: "Cairo (GMT+2)" },
    { value: "Europe/London", label: "London (GMT)" },
    { value: "America/New_York", label: "New York (GMT-5)" },
    { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
    { value: "UTC", label: "UTC" },
  ];
  
  const addPublishTime = () => {
    if (newPublishTime && !publishTimes.includes(newPublishTime)) {
      setPublishTimes([...publishTimes, newPublishTime].sort());
    }
  };
  
  const removePublishTime = (time: string) => {
    setPublishTimes(publishTimes.filter(t => t !== time));
  };
  
  // Fetch topic sources (gate on isAuthenticated to avoid 401s)
  const topicSourcesQuery = useQuery<TopicSourceWithDetails[]>({
    queryKey: [`/api/topics/${topic.id}/sources`],
    enabled: open && isAuthenticated,
  });
  
  // Fetch all available sources
  const allSourcesQuery = useQuery<any[]>({
    queryKey: ["/api/sources"],
    enabled: open && isAuthenticated,
  });
  
  const toggleSourceMutation = useMutation({
    mutationFn: async ({ sourceId, isEnabled }: { sourceId: string; isEnabled: boolean }) => {
      return await apiRequest("PATCH", `/api/topics/${topic.id}/sources/${sourceId}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topic.id, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
    },
    onError: () => {
      toast({ title: "Failed to update source", variant: "destructive" });
    },
  });
  
  const addSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return await apiRequest("POST", `/api/topics/${topic.id}/sources`, {
        sourceSelections: [{ sourceId, isEnabled: true }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topic.id, "sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Source added" });
    },
    onError: () => {
      toast({ title: "Failed to add source", variant: "destructive" });
    },
  });
  
  // Get enabled source IDs for quick lookup
  const enabledSourceIds = new Set(
    (topicSourcesQuery.data ?? []).filter(ts => ts.isEnabled).map(ts => ts.sourceId)
  );
  const topicSourceIds = new Set(
    (topicSourcesQuery.data ?? []).map(ts => ts.sourceId)
  );
  
  // Filter available sources not yet added to topic
  const availableSources = (allSourcesQuery.data ?? []).filter(
    s => !topicSourceIds.has(s.id) && s.name.toLowerCase().includes(sourceSearch.toLowerCase())
  );
  
  // Server auto-resolves workspace from session - include activeWorkspaceId in key for cache separation
  // Use object form to prevent URL concatenation (workspace ID is for cache key only, not URL)
  const { data: targets, isLoading: targetsLoading } = useQuery<PublishingTarget[]>({
    queryKey: ["/api/publishing-targets", { workspaceId: activeWorkspaceId }],
    enabled: open && isAuthenticated && !!activeWorkspaceId,
  });
  
  const wordPressTargets = useMemo(() => {
    const filtered = (targets ?? []).filter(t => t.type === "wordpress" || t.type === "wordpress_pull");
    console.log("[EditDialog] targets:", targets, "filtered:", filtered);
    return filtered;
  }, [targets]);
  
  const taxonomyQuery = useQuery<{ 
    items: WpTaxonomyCache[]; 
    lastSync: { categories: string | null; tags: string | null } 
  }>({
    queryKey: ["/api/publishing-targets", publishingTargetId, "taxonomy"],
    enabled: open && isAuthenticated && !!publishingTargetId,
  });
  
  const syncCategoriesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${publishingTargetId}/sync-categories`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", publishingTargetId, "taxonomy"] });
      toast({ title: "Categories synced", description: `${data.count} categories imported` });
    },
    onError: () => {
      toast({ title: "Failed to sync categories", variant: "destructive" });
    },
  });
  
  const syncTagsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${publishingTargetId}/sync-tags`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", publishingTargetId, "taxonomy"] });
      toast({ title: "Tags synced", description: `${data.count} tags imported` });
    },
    onError: () => {
      toast({ title: "Failed to sync tags", variant: "destructive" });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/topics/${topic.id}`, { 
        taxonomyRules: rules,
        timezone,
        publishTimes,
        articlesPerRun,
        runIntervalMinutes,
        publishingTargetId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic settings saved" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });
  
  const categories = taxonomyQuery.data?.items.filter(i => i.taxonomyType === "category") || [];
  const tags = taxonomyQuery.data?.items.filter(i => i.taxonomyType === "tag") || [];
  const categoryTree = buildCategoryTree(categories);
  
  const filteredTags = tagSearch 
    ? tags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
    : tags;
  
  const getTargetRules = (targetId: string) => {
    return rules[targetId] || { 
      defaultCategoryIds: [], 
      defaultTagIds: [], 
      locationMode: "none",
      allowCreateTags: true,
      allowCreateCategories: false
    };
  };
  
  const setTargetRules = (targetId: string, update: Partial<TopicTaxonomyRules[string]>) => {
    setRules(prev => ({
      ...prev,
      [targetId]: { ...getTargetRules(targetId), ...update }
    }));
  };
  
  const toggleCategory = (categoryId: number) => {
    if (!publishingTargetId) return;
    const current = getTargetRules(publishingTargetId).defaultCategoryIds || [];
    const updated = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    setTargetRules(publishingTargetId, { defaultCategoryIds: updated });
  };
  
  const toggleTag = (tagId: number) => {
    if (!publishingTargetId) return;
    const current = getTargetRules(publishingTargetId).defaultTagIds || [];
    const updated = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId];
    setTargetRules(publishingTargetId, { defaultTagIds: updated });
  };
  
  const targetRules = publishingTargetId ? getTargetRules(publishingTargetId) : null;
  const selectedCategories = targetRules?.defaultCategoryIds || [];
  const selectedTags = targetRules?.defaultTagIds || [];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Topic Settings: {topic.name}
          </DialogTitle>
          <DialogDescription>
            Configure publishing rules and taxonomy defaults
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="sources" data-testid="tab-topic-sources">
              <Rss className="w-4 h-4 mr-1" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="schedule" data-testid="tab-topic-schedule">
              <Clock className="w-4 h-4 mr-1" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="general" data-testid="tab-topic-general">General</TabsTrigger>
            <TabsTrigger value="taxonomy" data-testid="tab-topic-taxonomy">
              <FolderTree className="w-4 h-4 mr-1" />
              Taxonomy
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="sources" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label className="text-base font-medium">Topic Sources</Label>
                  <p className="text-xs text-muted-foreground">
                    {enabledSourceIds.size} sources enabled for this topic
                  </p>
                </div>
                {topicSourcesQuery.isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
              </div>
              
              {/* Current topic sources */}
              {(topicSourcesQuery.data ?? []).length > 0 ? (
                <ScrollArea className="h-48 rounded border p-2">
                  <div className="space-y-2">
                    {(topicSourcesQuery.data ?? []).map((ts) => (
                      <div 
                        key={ts.sourceId}
                        className="flex items-center justify-between gap-2 p-2 rounded hover-elevate"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {ts.source?.name || "Unknown source"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {ts.source?.domain || ts.source?.feedUrl}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {ts.source?.language && (
                            <Badge variant="outline" className="text-xs">
                              {ts.source.language.toUpperCase()}
                            </Badge>
                          )}
                          <Switch
                            checked={ts.isEnabled}
                            onCheckedChange={(checked) => 
                              toggleSourceMutation.mutate({ sourceId: ts.sourceId, isEnabled: checked })
                            }
                            disabled={toggleSourceMutation.isPending}
                            data-testid={`switch-source-${ts.sourceId}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 border rounded">
                  <Rss className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No sources assigned to this topic yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add sources below to start discovering stories.
                  </p>
                </div>
              )}
              
              {/* Add more sources */}
              <div className="border-t pt-4">
                <Label className="text-sm">Add More Sources</Label>
                <Input 
                  placeholder="Search sources..." 
                  className="mt-2"
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  data-testid="input-search-add-sources"
                />
                {allSourcesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : availableSources.length > 0 ? (
                  <ScrollArea className="h-32 mt-2 rounded border p-2">
                    <div className="space-y-1">
                      {availableSources.slice(0, 20).map((source) => (
                        <div 
                          key={source.id}
                          className="flex items-center justify-between gap-2 p-2 rounded hover-elevate cursor-pointer"
                          onClick={() => addSourceMutation.mutate(source.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{source.name}</p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            disabled={addSourceMutation.isPending}
                            data-testid={`button-add-source-${source.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    {sourceSearch ? "No matching sources found" : "All available sources are already added"}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="schedule" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Your Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger data-testid="select-timezone">
                    <SelectValue placeholder="Select timezone..." />
                  </SelectTrigger>
                  <SelectContent>
                    {commonTimezones.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Publishing times will be scheduled based on this timezone
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Publishing Times</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Add specific times when content should be published each day
                </p>
                
                <div className="flex gap-2">
                  <Input 
                    type="time" 
                    value={newPublishTime}
                    onChange={(e) => setNewPublishTime(e.target.value)}
                    className="flex-1"
                    data-testid="input-publish-time"
                  />
                  <Button onClick={addPublishTime} size="default" data-testid="button-add-publish-time">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Time
                  </Button>
                </div>
                
                {publishTimes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {publishTimes.map(time => (
                      <Badge 
                        key={time} 
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        {time}
                        <button
                          onClick={() => removePublishTime(time)}
                          className="ml-1 hover:text-destructive"
                          data-testid={`button-remove-time-${time}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic mt-2">
                    No publishing times set. Items will publish using interval spacing.
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Articles Per Run</Label>
                  <Select 
                    value={String(articlesPerRun)} 
                    onValueChange={(v) => setArticlesPerRun(Number(v))}
                  >
                    <SelectTrigger data-testid="select-articles-per-run">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 article</SelectItem>
                      <SelectItem value="2">2 articles</SelectItem>
                      <SelectItem value="3">3 articles</SelectItem>
                      <SelectItem value="4">4 articles</SelectItem>
                      <SelectItem value="5">5 articles</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Max articles per publishing slot
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Interval Between Articles</Label>
                  <Select 
                    value={String(runIntervalMinutes)} 
                    onValueChange={(v) => setRunIntervalMinutes(Number(v))}
                  >
                    <SelectTrigger data-testid="select-run-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 minutes</SelectItem>
                      <SelectItem value="3">3 minutes</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Time between each article
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Publishing Target</Label>
                <Select 
                  value={publishingTargetId || "none"} 
                  onValueChange={(value) => setPublishingTargetId(value === "none" ? null : value)}
                >
                  <SelectTrigger data-testid="select-publishing-target">
                    <SelectValue placeholder="Select a publishing target..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {wordPressTargets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targets && wordPressTargets.length === 0 && !targetsLoading ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-edit-no-targets-warning">
                    No targets found in this workspace. Create one in Publishing first.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose which WordPress site this topic publishes to
                  </p>
                )}
                {publishingTargetId && wordPressTargets.find(t => t.id === publishingTargetId) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{wordPressTargets.find(t => t.id === publishingTargetId)?.wpSiteUrl}</span>
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Default Content Language</Label>
                <Select 
                  value={topic.language || "en"} 
                  disabled
                >
                  <SelectTrigger data-testid="select-topic-language">
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Language for generated content from this topic
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Content Intent</Label>
                <Select 
                  value={topic.contentIntent || "news_monitoring"} 
                  disabled
                >
                  <SelectTrigger data-testid="select-topic-intent">
                    <SelectValue placeholder="Select intent..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news_monitoring">News Monitoring</SelectItem>
                    <SelectItem value="informational">Informational</SelectItem>
                    <SelectItem value="evergreen">Evergreen</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Determines how content is processed and prioritized
                </p>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Discovery Status</Label>
                  <p className="text-xs text-muted-foreground">
                    {topic.isLive === "true" ? "Topic is live and discovering stories" : "Topic is paused"}
                  </p>
                </div>
                <Badge variant={topic.isLive === "true" ? "default" : "secondary"}>
                  {topic.isLive === "true" ? "Live" : "Paused"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Output Volume</Label>
                  <p className="text-xs text-muted-foreground">
                    Target {topic.outputVolumePerDay || 5} stories per day
                  </p>
                </div>
                <Badge variant="outline">{topic.outputVolumePerDay || 5}/day</Badge>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="taxonomy" className="space-y-4 pt-4">
            {!publishingTargetId ? (
              <div className="text-center py-6">
                <FolderTree className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No publishing target linked to this topic.
                </p>
                <p className="text-xs text-muted-foreground">
                  Go to the General tab and select a Publishing Target first.
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const linkedTarget = wordPressTargets.find(t => t.id === publishingTargetId);
                  return linkedTarget ? (
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{linkedTarget.name}</span>
                      <span className="text-xs text-muted-foreground">{linkedTarget.wpSiteUrl}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Loading target...</div>
                  );
                })()}
                
                {publishingTargetId && targetRules && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">Default Categories</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncCategoriesMutation.mutate()}
                            disabled={syncCategoriesMutation.isPending}
                            data-testid="button-sync-categories-topic"
                          >
                            {syncCategoriesMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <ScrollArea className="h-40 rounded border p-2">
                          {categories.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-4">
                              Sync categories first
                            </div>
                          ) : (
                            categoryTree.map(cat => (
                              <CategoryTreeSelect 
                                key={cat.wpId} 
                                item={cat}
                                selectedIds={selectedCategories}
                                onToggle={toggleCategory}
                              />
                            ))
                          )}
                        </ScrollArea>
                        {selectedCategories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {categories
                              .filter(c => selectedCategories.includes(c.wpId))
                              .map(c => (
                                <Badge key={c.wpId} variant="secondary" className="text-xs">
                                  {c.name}
                                </Badge>
                              ))
                            }
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">Default Tags</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncTagsMutation.mutate()}
                            disabled={syncTagsMutation.isPending}
                            data-testid="button-sync-tags-topic"
                          >
                            {syncTagsMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <Input 
                          placeholder="Search tags..." 
                          className="h-8 text-sm"
                          value={tagSearch}
                          onChange={(e) => setTagSearch(e.target.value)}
                          data-testid="input-search-topic-tags"
                        />
                        <ScrollArea className="h-32 rounded border p-2">
                          {tags.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-4">
                              Sync tags first
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {filteredTags.slice(0, 50).map(tag => {
                                const isSelected = selectedTags.includes(tag.wpId);
                                return (
                                  <div 
                                    key={tag.wpId}
                                    className="flex items-center gap-2 py-1 px-2 hover-elevate rounded cursor-pointer"
                                    onClick={() => toggleTag(tag.wpId)}
                                    data-testid={`tag-option-${tag.wpId}`}
                                  >
                                    <Checkbox checked={isSelected} />
                                    <span className="text-sm">{tag.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                        {selectedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags
                              .filter(t => selectedTags.includes(t.wpId))
                              .map(t => (
                                <Badge key={t.wpId} variant="secondary" className="text-xs">
                                  {t.name}
                                </Badge>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label className="text-sm">Auto-create missing tags</Label>
                          <p className="text-xs text-muted-foreground">
                            Create new tags in WordPress if they dont exist
                          </p>
                        </div>
                        <Switch 
                          checked={targetRules.allowCreateTags}
                          onCheckedChange={(v) => setTargetRules(publishingTargetId!, { allowCreateTags: v })}
                          data-testid="switch-allow-create-tags"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label className="text-sm">Location-based categorization</Label>
                          <p className="text-xs text-muted-foreground">
                            Map countries in stories to categories/tags
                          </p>
                        </div>
                        <Select
                          value={targetRules.locationMode || "none"}
                          onValueChange={(v) => setTargetRules(publishingTargetId!, { locationMode: v as any })}
                        >
                          <SelectTrigger className="w-36" data-testid="select-location-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Disabled</SelectItem>
                            <SelectItem value="country_to_category">To Category</SelectItem>
                            <SelectItem value="country_to_tag">To Tag</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            data-testid="button-save-topic-settings"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RecommendedSource {
  sourceId?: string;
  name: string;
  displayName?: string;
  domain: string;
  country?: string | null;
  region?: string;
  language?: string;
  tier: 1 | 2 | 3;
  relevanceScore: number;
  matchReason: string;
  isVerified: boolean;
  isExisting: boolean;
  isOfficial: boolean;
}

const tierBadgeColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  2: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  3: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function SourceSelector({
  sources,
  selectedSourceIds,
  onToggleSource,
  isLoading,
  onRetryBroader,
  isBroadened,
  language,
}: {
  sources: RecommendedSource[];
  selectedSourceIds: Set<string>;
  onToggleSource: (id: string) => void;
  isLoading: boolean;
  onRetryBroader?: () => void;
  isBroadened?: boolean;
  language?: string;
}) {
  // Ensure sources is always an array to prevent crashes
  const safeSources = Array.isArray(sources) ? sources : [];
  
  const groupedByTier = useMemo(() => {
    const tier1 = safeSources.filter(s => s.tier === 1);
    const tier2 = safeSources.filter(s => s.tier === 2);
    const tier3 = safeSources.filter(s => s.tier === 3);
    return { tier1, tier2, tier3 };
  }, [safeSources]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Finding sources...</span>
      </div>
    );
  }

  if (safeSources.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <Newspaper className="w-10 h-10 mx-auto text-muted-foreground/50" />
        <div>
          <p className="font-medium">No sources found for this query</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or region settings
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          {onRetryBroader && (
            <Button variant="outline" size="sm" onClick={onRetryBroader} data-testid="button-try-broader">
              <RefreshCw className="w-4 h-4 mr-1" />
              Try Broader Query
            </Button>
          )}
          <Link href="/sources">
            <Button variant="outline" size="sm" data-testid="button-add-source-manual">
              <Plus className="w-4 h-4 mr-1" />
              Add Source Manually
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Or create topic anyway - it will start inactive until sources are added
        </p>
      </div>
    );
  }

  const renderSourceRow = (source: RecommendedSource) => {
    const id = source.sourceId || source.domain;
    if (!source.sourceId) return null;
    
    const isSelected = selectedSourceIds.has(source.sourceId);
    
    return (
      <div
        key={id}
        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover-elevate ${
          isSelected ? "bg-accent" : ""
        }`}
        onClick={() => source.sourceId && onToggleSource(source.sourceId)}
        data-testid={`source-row-${source.sourceId}`}
      >
        <div className="flex-shrink-0">
          {isSelected ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {source.displayName ? `${source.displayName} (${source.name})` : source.name}
          </div>
          <div className="text-xs text-muted-foreground truncate">{source.domain}</div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {source.tier === 1 && (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          )}
          <Badge variant="outline" className={`text-xs ${tierBadgeColors[source.tier]}`}>
            Tier {source.tier}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-4">
        {groupedByTier.tier1.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-medium">Tier 1 - Major Outlets</span>
              <Badge variant="secondary" className="text-xs">{groupedByTier.tier1.length}</Badge>
            </div>
            <div className="space-y-1">
              {groupedByTier.tier1.map(renderSourceRow)}
            </div>
          </div>
        )}
        
        {groupedByTier.tier2.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Tier 2 - Recognized Sources</span>
              <Badge variant="secondary" className="text-xs">{groupedByTier.tier2.length}</Badge>
            </div>
            <div className="space-y-1">
              {groupedByTier.tier2.map(renderSourceRow)}
            </div>
          </div>
        )}
        
        {groupedByTier.tier3.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Tier 3 - Other Sources</span>
              <Badge variant="secondary" className="text-xs">{groupedByTier.tier3.length}</Badge>
            </div>
            <div className="space-y-1">
              {groupedByTier.tier3.map(renderSourceRow)}
            </div>
          </div>
        )}
      </div>
      
      {isBroadened && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Showing broader results (Global • {language?.toUpperCase() || "EN"})
          </p>
        </div>
      )}
    </ScrollArea>
  );
}

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

function TopicCard({ 
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
  
  // Fetch topic stories
  const { data: storiesData } = useQuery<TopicStoriesResponse>({
    queryKey: ["/api/topics", topic.id, "stories"],
  });
  
  const topicStories = storiesData?.stories || [];
  
  const intent = contentIntentConfig[topic.contentIntent as ContentIntent] || contentIntentConfig.mixed;
  const IntentIcon = intent.icon;
  const isLive = topic.isLive === "true";
  const hasRules = Boolean(topic.taxonomyRules && typeof topic.taxonomyRules === 'object' && Object.keys(topic.taxonomyRules as object).length > 0);
  const canActivate = enabledSourceCount > 0 || isLive;
  const storiesCount = topicStories.length;

  return (
    <Card className="hover-elevate" data-testid={`topic-card-${topic.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${intent.color} text-white`}>
              <IntentIcon className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">
                {topic.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {intent.label} content
              </CardDescription>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-topic-menu-${topic.id}`}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={onRunDiscovery} 
                disabled={isDiscoveryPending || enabledSourceCount === 0}
                data-testid={`menu-run-discovery-${topic.id}`}
              >
                {isDiscoveryPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Run Discovery
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSettings} data-testid={`menu-edit-${topic.id}`}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={onDelete}
                data-testid={`menu-delete-${topic.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {topic.query && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {topic.query}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {topic.language || "en"}
            </Badge>
            {topic.outputVolumePerDay && (
              <Badge variant="outline" className="text-xs">
                {String(topic.outputVolumePerDay)}/day
              </Badge>
            )}
            {hasRules && (
              <Badge variant="secondary" className="text-xs">
                <FolderTree className="w-3 h-3 mr-1" />
                Rules
              </Badge>
            )}
            {storiesCount > 0 && (
              <Badge 
                variant="default" 
                className="text-xs cursor-pointer"
                onClick={() => setShowStories(!showStories)}
                data-testid={`badge-stories-${topic.id}`}
              >
                <Newspaper className="w-3 h-3 mr-1" />
                {storiesCount} stories
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isLive ? "Live" : enabledSourceCount === 0 ? "No Sources" : "Paused"}
            </span>
            <Switch
              checked={isLive}
              onCheckedChange={onToggleLive}
              disabled={isPending || !canActivate}
              data-testid={`switch-live-${topic.id}`}
            />
          </div>
        </div>
        
        {showStories && storiesCount > 0 && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Matched Stories</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowStories(false)}
                className="h-6 px-2 text-xs"
              >
                Hide
              </Button>
            </div>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {topicStories.slice(0, 10).map((story) => (
                  <div 
                    key={story.id} 
                    className="p-2 rounded-md bg-muted/50 text-sm"
                    data-testid={`story-item-${story.id}`}
                  >
                    <div className="font-medium line-clamp-1">{story.canonicalTitle}</div>
                    {story.topicRelevance && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {(story.topicRelevance.score * 100).toFixed(0)}% match
                        </Badge>
                        {story.topicRelevance.matchedTerms?.slice(0, 3).map((term) => (
                          <Badge key={term} variant="secondary" className="text-xs">
                            {term}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {storiesCount > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{storiesCount - 10} more stories
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {topic.automationMode && topic.automationMode !== "manual" && (
          <AutomationStatusCard 
            topic={topic} 
            hasWpPlugin={!!topic.publishingTargetId}
          />
        )}
      </CardContent>
    </Card>
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

function AutomationStatusCard({ 
  topic,
  hasWpPlugin 
}: { 
  topic: Topic;
  hasWpPlugin: boolean;
}) {
  const { toast } = useToast();
  const [showHistory, setShowHistory] = useState(false);
  
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

  const copyDebugBundle = async () => {
    const lastError = activity?.recentRuns?.find(r => r.failed > 0);
    const bundle = {
      topicId: topic.id,
      topicName: topic.name,
      automationMode: topic.automationMode,
      lastRunId: activity?.recentRuns?.[0]?.id || null,
      stats: activity?.stats || {},
      lastError: lastError ? {
        jobType: lastError.jobType,
        runId: lastError.id,
        failedAt: lastError.endedAt,
      } : null,
      recentJobs: activity?.recentRuns?.slice(0, 20) || [],
      timestamp: new Date().toISOString(),
      hasWpPlugin,
    };
    
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    toast({ title: "Debug bundle copied", description: "Paste this when reporting issues" });
  };

  const modeConfig: Record<string, { label: string; color: string; icon: any }> = {
    auto: { label: "Full Auto", color: "bg-green-500", icon: Zap },
    approval_required: { label: "Semi-Auto", color: "bg-amber-500", icon: Shield },
    manual: { label: "Manual", color: "bg-slate-500", icon: Pause },
  };

  const mode = modeConfig[topic.automationMode || "manual"] || modeConfig.manual;
  const ModeIcon = mode.icon;
  
  const hasErrors = (activity?.stats?.currentQuarantined || 0) > 0;
  const isHealthy = !hasErrors && activity?.lastRunStatus === "completed";
  const lastError = activity?.recentRuns?.find(r => r.failed > 0);

  if (topic.automationMode === "manual") {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-3" data-testid={`automation-status-${topic.id}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium flex items-center gap-2">
          <ModeIcon className="h-4 w-4" />
          Automation Status
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${mode.color} text-white`}>
            {mode.label}
          </Badge>
          {isHealthy ? (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Healthy
            </Badge>
          ) : hasErrors ? (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
                Issues
              </Badge>
            ) : null}
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-semibold">{activity?.stats?.totalGenerated || 0}</div>
                <div className="text-xs text-muted-foreground">Generated</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-semibold">{activity?.stats?.draftsCreated || 0}</div>
                <div className="text-xs text-muted-foreground">Drafts</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-semibold text-green-600">{activity?.stats?.todayPublished || 0}</div>
                <div className="text-xs text-muted-foreground">Published Today</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className={`text-lg font-semibold ${(activity?.stats?.currentQuarantined || 0) > 0 ? "text-destructive" : ""}`}>
                  {activity?.stats?.currentQuarantined || 0}
                </div>
                <div className="text-xs text-muted-foreground">Quarantined</div>
              </div>
            </div>

            {topic.automationMode === "approval_required" && (activity?.stats?.draftsPendingReview || 0) > 0 && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {activity?.stats?.draftsPendingReview} drafts awaiting review
                  </span>
                  <Link href="/smart-editor">
                    <Button size="sm" variant="outline" data-testid={`button-review-now-${topic.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      Review Now
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {lastError && (
              <div className="p-2 rounded-lg bg-destructive/10 text-xs">
                <span className="font-medium text-destructive">Last error: </span>
                <span className="text-muted-foreground">
                  {lastError.jobType} job failed ({lastError.failed} items) 
                  {lastError.endedAt && ` - ${formatDistanceToNow(new Date(lastError.endedAt))} ago`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Last run: {activity?.lastRunAt 
                  ? formatDistanceToNow(new Date(activity.lastRunAt)) + " ago"
                  : "Never"}
              </span>
              <span>Next: ~10 min cycle</span>
            </div>

            <Separator />

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => runPipelineMutation.mutate()}
                disabled={runPipelineMutation.isPending}
                data-testid={`button-run-now-${topic.id}`}
              >
                {runPipelineMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                Run Now
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHistory(!showHistory)}
                data-testid={`button-job-history-${topic.id}`}
              >
                <History className="h-3 w-3 mr-1" />
                Job History
              </Button>
              
              <Link href="/pipeline">
                <Button size="sm" variant="ghost" data-testid={`link-quarantine-${topic.id}`}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Quarantine
                </Button>
              </Link>
              
              {hasWpPlugin && (
                <Link href="/settings/publishing">
                  <Button size="sm" variant="ghost" data-testid={`link-plugin-diagnostics-${topic.id}`}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Plugin Diagnostics
                  </Button>
                </Link>
              )}
              
              <Button
                size="sm"
                variant="ghost"
                onClick={copyDebugBundle}
                data-testid={`button-copy-debug-${topic.id}`}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Debug Bundle
              </Button>
            </div>

            {showHistory && (
              <div className="pt-2 space-y-2">
                <div className="text-xs font-medium">Recent Job Runs</div>
                <ScrollArea className="h-32">
                  {activity?.recentRuns?.map((run) => (
                    <div key={run.id} className="flex items-center gap-2 py-1 text-xs">
                      <div className={`h-2 w-2 rounded-full ${
                        run.status === "completed" ? "bg-green-500" : 
                        run.status === "running" ? "bg-yellow-500 animate-pulse" : "bg-red-500"
                      }`} />
                      <Badge variant="outline" className="text-xs capitalize">{run.jobType}</Badge>
                      <span className="text-muted-foreground">
                        {run.success} ok, {run.failed} fail
                      </span>
                      <span className="text-muted-foreground ml-auto">
                        {run.startedAt ? formatDistanceToNow(new Date(run.startedAt)) + " ago" : ""}
                      </span>
                    </div>
                  ))}
                  {(!activity?.recentRuns || activity.recentRuns.length === 0) && (
                    <p className="text-xs text-muted-foreground py-2">No job runs yet</p>
                  )}
                </ScrollArea>
              </div>
            )}
          </>
        )}
    </div>
  );
}

export default function TopicsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [settingsTopic, setSettingsTopic] = useState<Topic | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [recommendedSources, setRecommendedSources] = useState<RecommendedSource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isBroadenedSearch, setIsBroadenedSearch] = useState(false);
  const [newTopic, setNewTopic] = useState({
    name: "",
    description: "",
    query: "",
    language: "en",
    region: "global",
    countries: [] as string[],
    contentIntent: "news_monitoring" as ContentIntent,
    outputVolumePerDay: 5,
    publishingTargetId: null as string | null,
  });

  // Auto-open create dialog from query param (e.g., /topics?create=1)
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    if (params.get("create") === "1") {
      setShowCreateDialog(true);
      // Clear the query param to prevent re-triggering
      setLocation("/topics", { replace: true });
    }
  }, [searchString, setLocation]);

  const { isAuthenticated } = useAuth();
  
  // Use unified workspace context for all workspace-scoped operations
  const { 
    activeWorkspaceId, 
    activeWorkspaceName,
    counts: workspaceCounts, 
    recentTargets,
    isLoading: isContextLoading 
  } = useWorkspaceContext();
  
  const { data: topics, isLoading, isError } = useQuery<(Topic & { enabledSourceCount: number })[]>({
    queryKey: ["/api/topics"],
    enabled: isAuthenticated,
  });
  
  // Safe array even on error or undefined
  const safeTopics = topics ?? [];
  
  // Use activeWorkspaceId from context as single source of truth - no fallback to avoid cross-workspace data
  const userWorkspaceId = activeWorkspaceId;

  // Fetch publishing targets for create dialog - include activeWorkspaceId in key for cache separation
  // Use object form to prevent URL concatenation (workspace ID is for cache key only, not URL)
  const { data: createDialogTargets, isLoading: isTargetsLoading } = useQuery<PublishingTarget[]>({
    queryKey: ["/api/publishing-targets", { workspaceId: activeWorkspaceId }],
    enabled: isAuthenticated && showCreateDialog && !!activeWorkspaceId,
  });
  
  const createDialogWordPressTargets = useMemo(() => 
    (createDialogTargets ?? []).filter(t => t.type === "wordpress" || t.type === "wordpress_pull"), 
    [createDialogTargets]
  );
  
  // Debug info for development (remove in production)
  const debugInfo = useMemo(() => ({
    activeWorkspaceId,
    isContextLoading,
    targetsCount: workspaceCounts?.targetsCount ?? 0,
    loadedTargets: createDialogTargets?.length ?? 0,
    wpTargets: createDialogWordPressTargets.length,
    isTargetsLoading,
  }), [activeWorkspaceId, isContextLoading, workspaceCounts, createDialogTargets, createDialogWordPressTargets, isTargetsLoading]);

  const fetchRecommendedSources = async (options?: { broaden?: boolean; retryCount?: number }) => {
    setIsLoadingSources(true);
    const broaden = options?.broaden ?? false;
    const retryCount = options?.retryCount ?? 0;
    const maxRetries = 2;
    
    try {
      const response = await apiRequest("POST", "/api/topics/recommend-sources", {
        topicQuery: newTopic.query,
        contentType: newTopic.contentIntent,
        // When broadening: use global region and drop countries
        region: broaden ? "global" : newTopic.region,
        countries: broaden ? [] : newTopic.countries,
        language: newTopic.language,
        workspaceId: userWorkspaceId,
      });
      const data = await response.json() as { sources: RecommendedSource[]; defaultEnabled: string[]; totalFound: number; query: string };
      setRecommendedSources(data.sources ?? []);
      setSelectedSourceIds(new Set(data.defaultEnabled ?? []));
      setIsBroadenedSearch(broaden);
    } catch (error: any) {
      console.error("Failed to fetch recommended sources:", error);
      
      // Retry on 401 errors (session might not be fully restored after server restart)
      const is401 = error?.message?.includes("401");
      if (is401 && retryCount < maxRetries) {
        console.log(`[Sources] Retrying after 401 (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        return fetchRecommendedSources({ broaden, retryCount: retryCount + 1 });
      }
      
      const errorMsg = is401 
        ? "Please sign in to discover sources" 
        : "Failed to load sources";
      toast({ title: errorMsg, variant: "destructive" });
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handleTryBroader = async () => {
    // Stay in Step 2, re-fetch with broadened parameters
    await fetchRecommendedSources({ broaden: true });
  };

  const saveTopicSourcesMutation = useMutation({
    mutationFn: async ({ topicId, sourceIds }: { topicId: string; sourceIds: string[] }) => {
      const sourceSelections = sourceIds.map(sourceId => ({
        sourceId,
        isEnabled: true,
      }));
      return await apiRequest("POST", `/api/topics/${topicId}/sources`, { sourceSelections });
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: typeof newTopic) => {
      const response = await apiRequest("POST", "/api/topics", {
        ...data,
        workspaceId: userWorkspaceId,
      });
      return await response.json();
    },
    onSuccess: async (result: any) => {
      if (selectedSourceIds.size > 0 && result?.id) {
        try {
          await saveTopicSourcesMutation.mutateAsync({
            topicId: result.id,
            sourceIds: Array.from(selectedSourceIds),
          });
        } catch (error) {
          console.error("Failed to save topic sources:", error);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic created", description: `${selectedSourceIds.size} sources enabled` });
      resetCreateDialog();
    },
  });

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setWizardStep(1);
    setRecommendedSources([]);
    setSelectedSourceIds(new Set());
    setIsBroadenedSearch(false);
    setNewTopic({
      name: "",
      description: "",
      query: "",
      language: "en",
      region: "global",
      countries: [],
      contentIntent: "news_monitoring",
      outputVolumePerDay: 5,
      publishingTargetId: null,
    });
  };

  const updateTopicMutation = useMutation({
    mutationFn: async ({ id, isLive }: { id: string; isLive: string }) => {
      return await apiRequest("PATCH", `/api/topics/${id}`, { isLive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
    },
    onError: (error: any) => {
      if (error?.code === "NO_SOURCES_ENABLED") {
        toast({
          title: "Cannot activate topic",
          description: "Please enable at least one source in topic settings first",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to update topic",
          description: error?.message || "An error occurred",
          variant: "destructive",
        });
      }
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/topics/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic deleted" });
    },
  });

  const runDiscoveryMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const response = await apiRequest("POST", `/api/topics/${topicId}/run-discovery`, {});
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", result.topicId, "stories"] });
      toast({ 
        title: "Discovery completed", 
        description: `Found ${result.matchedStories || 0} matching stories` 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Discovery failed",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleRunDiscovery = (topicId: string) => {
    runDiscoveryMutation.mutate(topicId);
  };

  const handleToggleLive = (topic: Topic) => {
    const newIsLive = topic.isLive === "true" ? "false" : "true";
    updateTopicMutation.mutate(
      { id: topic.id, isLive: newIsLive },
      {
        onSuccess: () => {
          toast({ 
            title: newIsLive === "true" ? "Topic activated" : "Topic paused" 
          });
        },
      }
    );
  };

  const handleDelete = (topicId: string) => {
    if (confirm("Are you sure you want to delete this topic?")) {
      deleteTopicMutation.mutate(topicId);
    }
  };

  const handleNextStep = async () => {
    if (wizardStep === 1) {
      if (!newTopic.name.trim()) return;
      setWizardStep(2);
      await fetchRecommendedSources();
    }
  };

  const handlePreviousStep = () => {
    if (wizardStep === 2) {
      setWizardStep(1);
    }
  };

  const handleToggleSource = (sourceId: string) => {
    const newSet = new Set(selectedSourceIds);
    if (newSet.has(sourceId)) {
      newSet.delete(sourceId);
    } else {
      newSet.add(sourceId);
    }
    setSelectedSourceIds(newSet);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.name.trim()) return;
    
    // Allow creating without sources - topic will be inactive
    if (selectedSourceIds.size === 0) {
      toast({ 
        title: "Creating inactive topic", 
        description: "Add and enable sources later to activate this topic",
      });
    }
    
    createTopicMutation.mutate(newTopic);
  };

  const liveTopics = safeTopics.filter(t => t.isLive === "true");
  const pausedTopics = safeTopics.filter(t => t.isLive !== "true");

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground">
            Manage your content topics and automated pipelines
          </p>
        </div>
        
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-topic">
          <Plus className="w-4 h-4 mr-2" />
          Create Topic
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Failed to Load Topics</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              There was an error loading your topics. Please try refreshing the page.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      ) : safeTopics.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-muted">
                <Globe className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">No Topics Yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Topics define what content you want to track and generate. Create your first topic to get started.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-topic">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Topic
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {liveTopics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Power className="w-4 h-4 text-green-500" />
                <h2 className="font-semibold">Live Topics</h2>
                <Badge variant="default">{liveTopics.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {liveTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onToggleLive={() => handleToggleLive(topic)}
                    onDelete={() => handleDelete(topic.id)}
                    onOpenSettings={() => setSettingsTopic(topic)}
                    onRunDiscovery={() => handleRunDiscovery(topic.id)}
                    isPending={updateTopicMutation.isPending}
                    isDiscoveryPending={runDiscoveryMutation.isPending}
                    enabledSourceCount={topic.enabledSourceCount}
                  />
                ))}
              </div>
            </div>
          )}

          {pausedTopics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <PowerOff className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold">Paused Topics</h2>
                <Badge variant="outline">{pausedTopics.length}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pausedTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onToggleLive={() => handleToggleLive(topic)}
                    onDelete={() => handleDelete(topic.id)}
                    onOpenSettings={() => setSettingsTopic(topic)}
                    onRunDiscovery={() => handleRunDiscovery(topic.id)}
                    isPending={updateTopicMutation.isPending}
                    isDiscoveryPending={runDiscoveryMutation.isPending}
                    enabledSourceCount={topic.enabledSourceCount}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && resetCreateDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {wizardStep === 1 ? "Create Topic" : "Select Sources"}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 1 
                ? "Define a new content topic to track and generate drafts"
                : "Choose which sources to enable for this topic"
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Workspace info line */}
          {activeWorkspaceName && (
            <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md mb-2">
              Workspace: <span className="font-medium text-foreground">{activeWorkspaceName}</span>
            </div>
          )}
          
          {process.env.NODE_ENV === "development" && (
            <div className="text-xs font-mono bg-muted/50 p-2 rounded mb-2 text-muted-foreground">
              WS: {debugInfo.activeWorkspaceId || "none"} |
              ctxLoad: {debugInfo.isContextLoading ? "Y" : "N"} |
              ctx-targets: {debugInfo.targetsCount} | 
              loaded: {debugInfo.loadedTargets} | 
              wp: {debugInfo.wpTargets} |
              targetsLoad: {debugInfo.isTargetsLoading ? "Y" : "N"}
            </div>
          )}
          
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex items-center gap-1 text-sm ${wizardStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${wizardStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                1
              </div>
              <span>Details</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <div className={`flex items-center gap-1 text-sm ${wizardStep >= 2 ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${wizardStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                2
              </div>
              <span>Sources</span>
            </div>
          </div>
          
          {wizardStep === 1 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Topic Name</Label>
                <Input
                  id="name"
                  value={newTopic.name}
                  onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                  placeholder="e.g., AI Industry News"
                  data-testid="input-create-topic-name"
                />
              </div>

              <div>
                <Label htmlFor="intent">Content Type</Label>
                <Select 
                  value={newTopic.contentIntent} 
                  onValueChange={(v) => setNewTopic({ ...newTopic, contentIntent: v as ContentIntent })}
                >
                  <SelectTrigger data-testid="select-create-topic-intent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news_monitoring">News Monitoring</SelectItem>
                    <SelectItem value="informational">Informational</SelectItem>
                    <SelectItem value="evergreen">Evergreen</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="query">What to Track</Label>
                <Textarea
                  id="query"
                  value={newTopic.query}
                  onChange={(e) => setNewTopic({ ...newTopic, query: e.target.value })}
                  placeholder="e.g., OpenAI announcements, AI regulations, machine learning breakthroughs"
                  className="resize-none"
                  rows={2}
                  data-testid="input-create-topic-query"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Select 
                    value={newTopic.region} 
                    onValueChange={(v) => setNewTopic({ ...newTopic, region: v })}
                  >
                    <SelectTrigger data-testid="select-create-topic-region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="mena">MENA</SelectItem>
                      <SelectItem value="gcc">GCC</SelectItem>
                      <SelectItem value="europe">Europe</SelectItem>
                      <SelectItem value="north_america">North America</SelectItem>
                      <SelectItem value="asia_pacific">Asia Pacific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select 
                    value={newTopic.countries[0] || ""} 
                    onValueChange={(v) => setNewTopic({ ...newTopic, countries: v ? [v] : [] })}
                  >
                    <SelectTrigger data-testid="select-create-topic-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ae">UAE</SelectItem>
                      <SelectItem value="sa">Saudi Arabia</SelectItem>
                      <SelectItem value="qa">Qatar</SelectItem>
                      <SelectItem value="kw">Kuwait</SelectItem>
                      <SelectItem value="bh">Bahrain</SelectItem>
                      <SelectItem value="om">Oman</SelectItem>
                      <SelectItem value="eg">Egypt</SelectItem>
                      <SelectItem value="jo">Jordan</SelectItem>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="gb">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select 
                    value={newTopic.language} 
                    onValueChange={(v) => setNewTopic({ ...newTopic, language: v })}
                  >
                    <SelectTrigger data-testid="select-create-topic-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="volume">Drafts per Day</Label>
                  <Select 
                    value={String(newTopic.outputVolumePerDay)} 
                    onValueChange={(v) => setNewTopic({ ...newTopic, outputVolumePerDay: parseInt(v) })}
                  >
                    <SelectTrigger data-testid="select-create-topic-volume">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="publishingTarget">Publishing Target</Label>
                <Select 
                  value={newTopic.publishingTargetId || "none"} 
                  onValueChange={(v) => setNewTopic({ ...newTopic, publishingTargetId: v === "none" ? null : v })}
                >
                  <SelectTrigger data-testid="select-create-topic-target">
                    <SelectValue placeholder="Select publishing target..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {createDialogWordPressTargets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createDialogTargets && createDialogWordPressTargets.length === 0 && !isTargetsLoading ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" data-testid="text-no-targets-warning">
                    No targets found in this workspace. Create one in Publishing first.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    WordPress site where content will be published
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetCreateDialog}>
                  Cancel
                </Button>
                <Button 
                  type="button"
                  onClick={handleNextStep}
                  disabled={!newTopic.name.trim()}
                  data-testid="button-wizard-next"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Topic: <span className="font-medium text-foreground">{newTopic.name}</span>
                </span>
                <Badge variant="secondary">
                  {selectedSourceIds.size} selected
                </Badge>
              </div>
              
              <SourceSelector
                sources={recommendedSources}
                selectedSourceIds={selectedSourceIds}
                onToggleSource={handleToggleSource}
                isLoading={isLoadingSources}
                onRetryBroader={handleTryBroader}
                isBroadened={isBroadenedSearch}
                language={newTopic.language}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handlePreviousStep}>
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTopicMutation.isPending}
                  variant={selectedSourceIds.size === 0 ? "outline" : "default"}
                  data-testid="button-submit-create-topic"
                >
                  {createTopicMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : selectedSourceIds.size === 0 ? (
                    <>
                      Create Inactive
                    </>
                  ) : (
                    <>
                      Create Topic
                      <Check className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {settingsTopic && (
        <TopicSettingsDialog
          topic={settingsTopic}
          open={!!settingsTopic}
          onOpenChange={(open) => !open && setSettingsTopic(null)}
        />
      )}
    </div>
  );
}
