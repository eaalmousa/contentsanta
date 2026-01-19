import { useState, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  const [activeTab, setActiveTab] = useState("general");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  
  const currentRules = topic.taxonomyRules as TopicTaxonomyRules || {};
  const [rules, setRules] = useState<TopicTaxonomyRules>(currentRules);
  
  const { data: targets } = useQuery<PublishingTarget[]>({
    queryKey: ["/api/publishing-targets", { workspaceId: "demo-workspace" }],
    queryFn: () => fetch("/api/publishing-targets?workspaceId=demo-workspace").then(r => r.json()),
  });
  
  const wordPressTargets = useMemo(() => 
    (targets ?? []).filter(t => t.type === "wordpress"), 
    [targets]
  );
  
  const taxonomyQuery = useQuery<{ 
    items: WpTaxonomyCache[]; 
    lastSync: { categories: string | null; tags: string | null } 
  }>({
    queryKey: ["/api/publishing-targets", selectedTargetId, "taxonomy"],
    enabled: !!selectedTargetId,
  });
  
  const syncCategoriesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${selectedTargetId}/sync-categories`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", selectedTargetId, "taxonomy"] });
      toast({ title: "Categories synced", description: `${data.count} categories imported` });
    },
    onError: () => {
      toast({ title: "Failed to sync categories", variant: "destructive" });
    },
  });
  
  const syncTagsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/publishing-targets/${selectedTargetId}/sync-tags`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing-targets", selectedTargetId, "taxonomy"] });
      toast({ title: "Tags synced", description: `${data.count} tags imported` });
    },
    onError: () => {
      toast({ title: "Failed to sync tags", variant: "destructive" });
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PATCH", `/api/topics/${topic.id}`, { 
        taxonomyRules: rules 
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
    if (!selectedTargetId) return;
    const current = getTargetRules(selectedTargetId).defaultCategoryIds || [];
    const updated = current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId];
    setTargetRules(selectedTargetId, { defaultCategoryIds: updated });
  };
  
  const toggleTag = (tagId: number) => {
    if (!selectedTargetId) return;
    const current = getTargetRules(selectedTargetId).defaultTagIds || [];
    const updated = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId];
    setTargetRules(selectedTargetId, { defaultTagIds: updated });
  };
  
  const targetRules = selectedTargetId ? getTargetRules(selectedTargetId) : null;
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
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="general" data-testid="tab-topic-general">General</TabsTrigger>
            <TabsTrigger value="taxonomy" data-testid="tab-topic-taxonomy">
              <FolderTree className="w-4 h-4 mr-1" />
              Taxonomy Rules
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground">
              General topic settings will be added here.
            </div>
          </TabsContent>
          
          <TabsContent value="taxonomy" className="space-y-4 pt-4">
            {wordPressTargets.length === 0 ? (
              <div className="text-center py-6">
                <FolderTree className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No WordPress targets configured.
                </p>
                <p className="text-xs text-muted-foreground">
                  Add a WordPress target in Publishing to configure taxonomy rules.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label>WordPress Target</Label>
                  <Select 
                    value={selectedTargetId || ""} 
                    onValueChange={setSelectedTargetId}
                  >
                    <SelectTrigger data-testid="select-wp-target">
                      <SelectValue placeholder="Select a target..." />
                    </SelectTrigger>
                    <SelectContent>
                      {wordPressTargets.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedTargetId && targetRules && (
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
                          onCheckedChange={(v) => setTargetRules(selectedTargetId, { allowCreateTags: v })}
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
                          onValueChange={(v) => setTargetRules(selectedTargetId, { locationMode: v as any })}
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
      </CardContent>
    </Card>
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

  const { data: topics, isLoading, isError } = useQuery<(Topic & { enabledSourceCount: number })[]>({
    queryKey: ["/api/topics"],
  });
  
  // Safe array even on error or undefined
  const safeTopics = topics ?? [];

  const fetchRecommendedSources = async (options?: { broaden?: boolean }) => {
    setIsLoadingSources(true);
    const broaden = options?.broaden ?? false;
    
    try {
      const response = await apiRequest("POST", "/api/topics/recommend-sources", {
        topicQuery: newTopic.query,
        contentType: newTopic.contentIntent,
        // When broadening: use global region and drop countries
        region: broaden ? "global" : newTopic.region,
        countries: broaden ? [] : newTopic.countries,
        language: newTopic.language,
        workspaceId: "demo-workspace",
      });
      const data = await response.json() as { sources: RecommendedSource[]; defaultEnabled: string[]; totalFound: number; query: string };
      setRecommendedSources(data.sources ?? []);
      setSelectedSourceIds(new Set(data.defaultEnabled ?? []));
      setIsBroadenedSearch(broaden);
    } catch (error: any) {
      console.error("Failed to fetch recommended sources:", error);
      const errorMsg = error?.message?.includes("401") 
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
        workspaceId: "demo-workspace",
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
