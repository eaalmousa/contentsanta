import { useState, useMemo } from "react";
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
    queryKey: ["/api/publishing-targets"],
  });
  
  const wordPressTargets = useMemo(() => 
    targets?.filter(t => t.targetType === "wordpress") || [], 
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

function TopicCard({ 
  topic, 
  onToggleLive,
  onDelete,
  onOpenSettings,
  isPending
}: { 
  topic: Topic;
  onToggleLive: () => void;
  onDelete: () => void;
  onOpenSettings: () => void;
  isPending: boolean;
}) {
  const intent = contentIntentConfig[topic.contentIntent as ContentIntent] || contentIntentConfig.mixed;
  const IntentIcon = intent.icon;
  const isLive = topic.isLive === "true";
  const hasRules = topic.taxonomyRules && Object.keys(topic.taxonomyRules).length > 0;

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
                {topic.outputVolumePerDay}/day
              </Badge>
            )}
            {hasRules && (
              <Badge variant="secondary" className="text-xs">
                <FolderTree className="w-3 h-3 mr-1" />
                Rules
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isLive ? "Live" : "Paused"}
            </span>
            <Switch
              checked={isLive}
              onCheckedChange={onToggleLive}
              disabled={isPending}
              data-testid={`switch-live-${topic.id}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TopicsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [settingsTopic, setSettingsTopic] = useState<Topic | null>(null);
  const [newTopic, setNewTopic] = useState({
    name: "",
    description: "",
    query: "",
    language: "en",
    contentIntent: "news_monitoring" as ContentIntent,
    outputVolumePerDay: 5,
  });

  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: typeof newTopic) => {
      return await apiRequest("POST", "/api/topics", {
        ...data,
        workspaceId: "demo-workspace",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic created" });
      setShowCreateDialog(false);
      setNewTopic({
        name: "",
        description: "",
        query: "",
        language: "en",
        contentIntent: "news_monitoring",
        outputVolumePerDay: 5,
      });
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: async ({ id, isLive }: { id: string; isLive: string }) => {
      return await apiRequest("PATCH", `/api/topics/${id}`, { isLive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
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

  const handleToggleLive = (topic: Topic) => {
    const newIsLive = topic.isLive === "true" ? "false" : "true";
    updateTopicMutation.mutate({ id: topic.id, isLive: newIsLive });
    toast({ 
      title: newIsLive === "true" ? "Topic activated" : "Topic paused" 
    });
  };

  const handleDelete = (topicId: string) => {
    if (confirm("Are you sure you want to delete this topic?")) {
      deleteTopicMutation.mutate(topicId);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.name.trim()) return;
    createTopicMutation.mutate(newTopic);
  };

  const liveTopics = topics?.filter(t => t.isLive === "true") || [];
  const pausedTopics = topics?.filter(t => t.isLive !== "true") || [];

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
      ) : !topics || topics.length === 0 ? (
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
                    isPending={updateTopicMutation.isPending}
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
                    isPending={updateTopicMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Topic</DialogTitle>
            <DialogDescription>
              Define a new content topic to track and generate drafts
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreate} className="space-y-4">
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
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!newTopic.name.trim() || createTopicMutation.isPending}
                data-testid="button-submit-create-topic"
              >
                {createTopicMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Topic"
                )}
              </Button>
            </DialogFooter>
          </form>
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
