import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Sparkles, 
  Filter, 
  Check, 
  X, 
  Edit3,
  ChevronRight,
  Globe,
  Clock,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Send,
  Eye,
  Lock,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Draft, Topic, Story } from "@shared/schema";

interface StorySource {
  name: string;
  url: string;
  mediaTier: string;
  isPrimary: boolean;
  imageUrl?: string;
}

interface StoryWithProvenance extends Story {
  sources: StorySource[];
  featuredImage: any | null;
}

function getTierBadgeVariant(tier: string): "default" | "secondary" | "outline" {
  switch (tier) {
    case "tier_1": return "default";
    case "tier_2": return "secondary";
    default: return "outline";
  }
}

function GenerateImageButton({ 
  storyId, 
  workspaceId,
  onSuccess 
}: { 
  storyId: string;
  workspaceId: string;
  onSuccess?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);
  const { toast } = useToast();
  
  const { data: features } = useQuery<{ generate_images: boolean }>({
    queryKey: ['/api/workspaces', workspaceId, 'features'],
  });
  
  const generateMutation = useMutation({
    mutationFn: async (data: { prompt: string }) => {
      const response = await apiRequest("POST", "/api/image-assets/generate", {
        workspaceId,
        storyId,
        prompt: data.prompt,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === "pending") {
        toast({
          title: "Image generation queued",
          description: "Your image is being generated. This may take a moment.",
        });
      }
      setShowPromptInput(false);
      setPrompt("");
      onSuccess?.();
    },
    onError: (error: any) => {
      if (error.message?.includes("FEATURE_NOT_ENTITLED")) {
        toast({
          title: "Premium Feature",
          description: "Image generation requires a premium plan.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate image",
          variant: "destructive",
        });
      }
    },
  });
  
  const isEntitled = features?.generate_images ?? false;
  
  if (!isEntitled) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled
        className="gap-2 opacity-60"
        data-testid="button-generate-image-locked"
      >
        <Lock className="w-3 h-3" />
        <Wand2 className="w-4 h-4" />
        Generate Image
        <Badge variant="secondary" className="ml-1 text-xs">Premium</Badge>
      </Button>
    );
  }
  
  if (showPromptInput) {
    return (
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Describe the image..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="text-sm"
          data-testid="input-generate-prompt"
        />
        <Button
          size="sm"
          onClick={() => generateMutation.mutate({ prompt })}
          disabled={!prompt.trim() || generateMutation.isPending}
          data-testid="button-generate-submit"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wand2 className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowPromptInput(false)}
          data-testid="button-generate-cancel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={() => setShowPromptInput(true)}
      className="gap-2"
      data-testid="button-generate-image"
    >
      <Wand2 className="w-4 h-4" />
      Generate Image
    </Button>
  );
}

function StoryCard({ 
  story, 
  onCreateDraft, 
  onViewDetails,
  isPending 
}: { 
  story: StoryWithProvenance;
  onCreateDraft: () => void;
  onViewDetails: () => void;
  isPending: boolean;
}) {
  const primarySource = story.sources.find(s => s.isPrimary) || story.sources[0];
  const hasImage = story.featuredImage?.originalUrl || primarySource?.imageUrl;
  
  return (
    <Card className="hover-elevate overflow-visible" data-testid={`story-card-${story.id}`}>
      {hasImage && (
        <div className="relative h-32 bg-muted overflow-hidden rounded-t-md">
          <img 
            src={story.featuredImage?.originalUrl || primarySource?.imageUrl} 
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              target.parentElement?.classList.add('flex', 'items-center', 'justify-center');
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}
      <CardHeader className={hasImage ? "pt-3 pb-2" : "pb-2"}>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-medium line-clamp-2">
            {story.canonicalTitle}
          </CardTitle>
          {story.sourceCount && story.sourceCount > 1 && (
            <Badge variant="secondary" className="shrink-0">
              {story.sourceCount} sources
            </Badge>
          )}
        </div>
        {story.excerpt && (
          <CardDescription className="line-clamp-2 mt-1">
            {story.excerpt}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {story.sources.length > 0 && (
          <div className="mb-3">
            <span className="text-xs text-muted-foreground mr-2">Reported by:</span>
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {story.sources.slice(0, 4).map((source, i) => (
                <Badge 
                  key={i} 
                  variant={getTierBadgeVariant(source.mediaTier)}
                  className="text-xs"
                >
                  {source.name}
                </Badge>
              ))}
              {story.sources.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{story.sources.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={onViewDetails}
            data-testid={`button-view-story-${story.id}`}
          >
            <Eye className="w-3 h-3 mr-1" />
            Details
          </Button>
          <Button 
            size="sm" 
            variant="default"
            onClick={onCreateDraft}
            disabled={isPending}
            data-testid={`button-create-draft-${story.id}`}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Create Draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DraftCard({ 
  draft, 
  onApprove, 
  onReject, 
  onEdit,
  onPublish,
  isPending 
}: { 
  draft: Draft;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onPublish: () => void;
  isPending: boolean;
}) {
  const provenance = Array.isArray(draft.provenance) ? draft.provenance : [];
  
  return (
    <Card className="hover-elevate overflow-visible" data-testid={`draft-card-${draft.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium line-clamp-2">
              {draft.title}
            </CardTitle>
            {draft.angle && (
              <CardDescription className="mt-1 line-clamp-2">
                {draft.angle}
              </CardDescription>
            )}
          </div>
          <Badge variant={
            draft.status === "approved" ? "default" :
            draft.status === "rejected" ? "destructive" :
            draft.status === "published" ? "secondary" :
            draft.status === "in_review" ? "secondary" :
            "outline"
          }>
            {draft.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {provenance.length > 0 && (
          <div className="mb-3">
            <span className="text-xs text-muted-foreground mr-1">Based on:</span>
            <div className="flex items-center gap-1 flex-wrap mt-1">
              {provenance.slice(0, 3).map((source: any, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {source.name || source}
                </Badge>
              ))}
              {provenance.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{provenance.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={onEdit}
            disabled={isPending}
            data-testid={`button-edit-draft-${draft.id}`}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Edit
          </Button>
          {draft.status !== "approved" && draft.status !== "published" && (
            <Button 
              size="sm" 
              variant="default"
              onClick={onApprove}
              disabled={isPending}
              data-testid={`button-approve-draft-${draft.id}`}
            >
              <Check className="w-3 h-3 mr-1" />
              Approve
            </Button>
          )}
          {draft.status === "approved" && (
            <Button 
              size="sm" 
              variant="default"
              onClick={onPublish}
              disabled={isPending}
              data-testid={`button-publish-draft-${draft.id}`}
            >
              <Send className="w-3 h-3 mr-1" />
              Publish
            </Button>
          )}
          {draft.status !== "rejected" && draft.status !== "published" && (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onReject}
              disabled={isPending}
              data-testid={`button-reject-draft-${draft.id}`}
            >
              <X className="w-3 h-3 mr-1" />
              Reject
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StoryDetailsDialog({
  story,
  open,
  onClose,
}: {
  story: StoryWithProvenance | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!story) return null;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{story.canonicalTitle}</DialogTitle>
          {story.excerpt && (
            <DialogDescription>{story.excerpt}</DialogDescription>
          )}
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Sources ({story.sources.length})</h4>
            <div className="space-y-2">
              {story.sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant={getTierBadgeVariant(source.mediaTier)} className="text-xs">
                      {source.mediaTier === 'tier_1' ? 'Tier 1' : 
                       source.mediaTier === 'tier_2' ? 'Tier 2' : 'Tier 3'}
                    </Badge>
                    <span className="font-medium">{source.name}</span>
                    {source.isPrimary && (
                      <Badge variant="outline" className="text-xs">Primary</Badge>
                    )}
                  </div>
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Featured Image</h4>
              <GenerateImageButton 
                storyId={story.id}
                workspaceId={story.workspaceId}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['/api/stories', story.id] })}
              />
            </div>
            {story.featuredImage?.originalUrl ? (
              <div className="rounded-md overflow-hidden bg-muted">
                <img 
                  src={story.featuredImage.originalUrl} 
                  alt={story.featuredImage.caption || ''} 
                  className="w-full h-48 object-cover"
                />
                {story.featuredImage.caption && (
                  <p className="text-xs text-muted-foreground p-2">
                    {story.featuredImage.caption}
                    {story.featuredImage.credit && ` (Credit: ${story.featuredImage.credit})`}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-muted/50 border-2 border-dashed border-muted-foreground/25 h-32 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No featured image available</p>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SmartEditorPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("stories");
  const [selectedStory, setSelectedStory] = useState<StoryWithProvenance | null>(null);

  const { data: stories, isLoading: storiesLoading } = useQuery<StoryWithProvenance[]>({
    queryKey: ["/api/stories"],
  });

  const { data: drafts, isLoading: draftsLoading } = useQuery<Draft[]>({
    queryKey: ["/api/drafts"],
  });

  const { data: topics } = useQuery<Topic[]>({
    queryKey: ["/api/topics"],
  });

  const updateDraftMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/drafts/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: async (story: StoryWithProvenance) => {
      return await apiRequest("POST", "/api/drafts", {
        workspaceId: story.workspaceId,
        storyId: story.id,
        title: story.canonicalTitle,
        angle: story.excerpt,
        provenance: story.sources.map(s => ({ name: s.name, url: s.url })),
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({ title: "Draft created", description: "You can now edit and approve the draft" });
      setActiveTab("drafts");
    },
  });

  const handleApprove = (draftId: string) => {
    updateDraftMutation.mutate({ id: draftId, status: "approved" });
    toast({ title: "Draft approved", description: "Ready for publishing" });
  };

  const handleReject = (draftId: string) => {
    updateDraftMutation.mutate({ id: draftId, status: "rejected" });
    toast({ title: "Draft rejected" });
  };

  const handlePublish = (draft: Draft) => {
    updateDraftMutation.mutate({ id: draft.id, status: "published" });
    toast({ title: "Publishing...", description: "Draft is being published" });
  };

  const handleEdit = (draft: Draft) => {
    toast({ title: "Opening editor...", description: draft.title });
  };

  const handleCreateDraft = (story: StoryWithProvenance) => {
    createDraftMutation.mutate(story);
  };

  const runDiscoveryMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const response = await apiRequest("POST", `/api/topics/${topicId}/run-discovery`, {});
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
    },
    onError: (error: any) => {
      toast({
        title: "Discovery failed",
        description: error?.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleRefreshAll = async () => {
    const liveTopics = topics?.filter(t => t.isLive === "true") || [];
    if (liveTopics.length === 0) {
      toast({ title: "No live topics", description: "Enable at least one topic to run discovery" });
      return;
    }
    
    toast({ title: "Running discovery...", description: `Scanning ${liveTopics.length} live topic(s)` });
    
    let totalMatched = 0;
    for (const topic of liveTopics) {
      try {
        const result = await runDiscoveryMutation.mutateAsync(topic.id);
        totalMatched += result?.matchedStories || 0;
      } catch (e) {
        // Individual errors already toasted
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
    toast({ title: "Discovery completed", description: `Found ${totalMatched} total matching stories` });
  };

  const filteredDrafts = drafts?.filter(d => 
    statusFilter === "all" || d.status === statusFilter
  ) || [];

  const pendingDrafts = drafts?.filter(d => d.status === "pending" || d.status === "draft" || d.status === "in_review") || [];
  const approvedDrafts = drafts?.filter(d => d.status === "approved") || [];
  const publishedDrafts = drafts?.filter(d => d.status === "published") || [];

  const hasTopics = topics && topics.length > 0;
  const hasContent = (stories && stories.length > 0) || (drafts && drafts.length > 0);
  
  const liveTopics = topics?.filter(t => t.isLive === "true") || [];
  const automatedTopics = liveTopics.filter(t => t.automationMode === "auto" || t.automationMode === "approval_required");
  const manualTopics = liveTopics.filter(t => t.automationMode === "manual" || !t.automationMode);
  const hasAutomation = automatedTopics.length > 0;
  const automationDrafts = drafts?.filter(d => d.pipelineItemId !== null) || [];

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Editor</h1>
          <p className="text-muted-foreground">
            Review stories and manage your content pipeline
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefreshAll}
          disabled={runDiscoveryMutation.isPending}
          data-testid="button-refresh-discovery"
        >
          {runDiscoveryMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh Stories
        </Button>
      </div>

      {!hasTopics && !hasContent ? (
        <Card className="text-center py-12 overflow-visible">
          <CardContent>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome to Smart Editor</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first topic to start discovering content and generating drafts.
            </p>
            <Link href="/topics?create=1">
              <Button data-testid="button-get-started">
                Create Your First Topic
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {topics && topics.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {topics.map((topic) => (
                <Badge 
                  key={topic.id} 
                  variant={topic.isLive === "true" ? "default" : "outline"}
                  className="whitespace-nowrap cursor-pointer"
                  data-testid={`badge-topic-${topic.id}`}
                >
                  {topic.name}
                  {topic.isLive === "true" && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />
                  )}
                  {topic.automationMode === "auto" && (
                    <Sparkles className="w-3 h-3 ml-1 text-amber-500" />
                  )}
                  {topic.automationMode === "approval_required" && (
                    <Eye className="w-3 h-3 ml-1 text-blue-500" />
                  )}
                </Badge>
              ))}
            </div>
          )}
          
          {hasAutomation && (
            <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/10 overflow-visible">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {automatedTopics.length} topic{automatedTopics.length !== 1 ? 's' : ''} running in automation mode
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drafts are created automatically. Check the Drafts tab for items awaiting review.
                      {automationDrafts.length > 0 && ` (${automationDrafts.length} automated drafts)`}
                    </p>
                  </div>
                  <Link href="/pipeline">
                    <Button size="sm" variant="outline" data-testid="button-view-pipeline">
                      View Pipeline
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="stories" data-testid="tab-stories">
                  Stories
                  {stories && stories.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{stories.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="drafts" data-testid="tab-drafts">
                  Drafts
                  {pendingDrafts.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{pendingDrafts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">
                  Ready to Publish
                  {approvedDrafts.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{approvedDrafts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="published" data-testid="tab-published">Published</TabsTrigger>
              </TabsList>

              {activeTab === "drafts" && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Drafts</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_review">In Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <TabsContent value="stories" className="space-y-4">
              {storiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !stories || stories.length === 0 ? (
                <Card className="text-center py-8 overflow-visible">
                  <CardContent>
                    <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No stories yet. Stories will appear here as your topics discover new content.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stories.map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onCreateDraft={() => handleCreateDraft(story)}
                      onViewDetails={() => setSelectedStory(story)}
                      isPending={createDraftMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="drafts" className="space-y-4">
              {draftsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingDrafts.length === 0 ? (
                <Card className="text-center py-8 overflow-visible">
                  <CardContent>
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No drafts in progress. Create drafts from stories to start editing.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(statusFilter === "all" ? pendingDrafts : filteredDrafts).map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={() => handleApprove(draft.id)}
                      onReject={() => handleReject(draft.id)}
                      onEdit={() => handleEdit(draft)}
                      onPublish={() => handlePublish(draft)}
                      isPending={updateDraftMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              {approvedDrafts.length === 0 ? (
                <Card className="text-center py-8 overflow-visible">
                  <CardContent>
                    <Check className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No approved drafts. Approve drafts to see them here ready for publishing.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {approvedDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={() => {}}
                      onReject={() => handleReject(draft.id)}
                      onEdit={() => handleEdit(draft)}
                      onPublish={() => handlePublish(draft)}
                      isPending={updateDraftMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="published">
              {publishedDrafts.length === 0 ? (
                <Card className="text-center py-8 overflow-visible">
                  <CardContent>
                    <ExternalLink className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      Published content will appear here with links to your destinations.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {publishedDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={() => {}}
                      onReject={() => {}}
                      onEdit={() => handleEdit(draft)}
                      onPublish={() => {}}
                      isPending={false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      
      <StoryDetailsDialog 
        story={selectedStory} 
        open={!!selectedStory}
        onClose={() => setSelectedStory(null)}
      />
    </div>
  );
}
