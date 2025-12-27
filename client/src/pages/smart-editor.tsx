import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Sparkles, 
  Filter, 
  Check, 
  X, 
  Edit3,
  ChevronRight,
  Globe,
  BookOpen,
  FileText,
  Shuffle,
  Clock,
  ExternalLink,
  Loader2,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Draft, Topic, ContentIntent } from "@shared/schema";

const contentIntentOptions: { value: ContentIntent; label: string; description: string; icon: any }[] = [
  { 
    value: "news_monitoring", 
    label: "News Monitoring", 
    description: "Track breaking news and updates from trusted sources",
    icon: Globe 
  },
  { 
    value: "informational", 
    label: "Informational", 
    description: "Educational content and research-based articles",
    icon: BookOpen 
  },
  { 
    value: "evergreen", 
    label: "Evergreen", 
    description: "Timeless content for blogs and long-term value",
    icon: FileText 
  },
  { 
    value: "mixed", 
    label: "Mixed", 
    description: "Combination of news, informational, and evergreen content",
    icon: Shuffle 
  },
];

function DraftCard({ 
  draft, 
  onApprove, 
  onReject, 
  onEdit,
  isPending 
}: { 
  draft: Draft;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  isPending: boolean;
}) {
  const provenance = Array.isArray(draft.provenance) ? draft.provenance : [];
  
  return (
    <Card className="hover-elevate" data-testid={`draft-card-${draft.id}`}>
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
            draft.status === "in_review" ? "secondary" :
            "outline"
          }>
            {draft.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {provenance.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <span>Based on:</span>
            {provenance.slice(0, 3).map((source: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                {source.name || source}
              </Badge>
            ))}
            {provenance.length > 3 && (
              <span>+{provenance.length - 3} more</span>
            )}
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
          <Button 
            size="sm" 
            variant="default"
            onClick={onApprove}
            disabled={isPending || draft.status === "approved"}
            data-testid={`button-approve-draft-${draft.id}`}
          >
            <Check className="w-3 h-3 mr-1" />
            Approve
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={onReject}
            disabled={isPending || draft.status === "rejected"}
            data-testid={`button-reject-draft-${draft.id}`}
          >
            <X className="w-3 h-3 mr-1" />
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentIntentStep({ 
  selectedIntent,
  onSelect 
}: { 
  selectedIntent: ContentIntent | null;
  onSelect: (intent: ContentIntent) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">What type of content are you creating?</h2>
        <p className="text-muted-foreground mt-1">
          This helps us find the right sources and generate appropriate drafts
        </p>
      </div>
      
      <div className="grid gap-3 md:grid-cols-2">
        {contentIntentOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedIntent === option.value;
          
          return (
            <Card 
              key={option.value}
              className={`cursor-pointer transition-all hover-elevate ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => onSelect(option.value)}
              data-testid={`intent-${option.value}`}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <div className={`p-2 rounded-md ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{option.label}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                {isSelected && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TopicSetupStep({
  onCreateTopic,
  isCreating
}: {
  onCreateTopic: (data: { name: string; query: string; language: string }) => void;
  isCreating: boolean;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("en");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !query.trim()) return;
    onCreateTopic({ name, query, language });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Define Your Topic</h2>
        <p className="text-muted-foreground mt-1">
          Tell us what you want to track and create content about
        </p>
      </div>

      <div className="space-y-4 max-w-lg mx-auto">
        <div>
          <label className="text-sm font-medium mb-1 block">Topic Name</label>
          <Input
            placeholder="e.g., AI Industry News, Tech Startups"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-topic-name"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">What to Track</label>
          <Textarea
            placeholder="e.g., artificial intelligence announcements, machine learning breakthroughs, OpenAI updates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="resize-none"
            rows={3}
            data-testid="input-topic-query"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">Arabic</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={!name.trim() || !query.trim() || isCreating}
          data-testid="button-create-topic"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create Topic
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function SmartEditorPage() {
  const { toast } = useToast();
  const [selectedIntent, setSelectedIntent] = useState<ContentIntent | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const createTopicMutation = useMutation({
    mutationFn: async (data: { name: string; query: string; language: string; contentIntent: ContentIntent }) => {
      return await apiRequest("POST", "/api/topics", {
        ...data,
        workspaceId: "demo-workspace",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      toast({ title: "Topic created", description: "Your topic is now active" });
      setShowSetup(false);
      setSelectedIntent(null);
    },
  });

  const handleApprove = (draftId: string) => {
    updateDraftMutation.mutate({ id: draftId, status: "approved" });
    toast({ title: "Draft approved" });
  };

  const handleReject = (draftId: string) => {
    updateDraftMutation.mutate({ id: draftId, status: "rejected" });
    toast({ title: "Draft rejected" });
  };

  const handleEdit = (draft: Draft) => {
    toast({ title: "Opening editor...", description: draft.title });
  };

  const handleCreateTopic = (data: { name: string; query: string; language: string }) => {
    if (!selectedIntent) return;
    createTopicMutation.mutate({
      ...data,
      contentIntent: selectedIntent,
    });
  };

  const filteredDrafts = drafts?.filter(d => 
    statusFilter === "all" || d.status === statusFilter
  ) || [];

  const hasTopics = topics && topics.length > 0;
  const hasDrafts = drafts && drafts.length > 0;

  if (showSetup) {
    return (
      <div className="container max-w-3xl py-8">
        <Button 
          variant="ghost" 
          onClick={() => {
            if (selectedIntent) {
              setSelectedIntent(null);
            } else {
              setShowSetup(false);
            }
          }}
          className="mb-4"
          data-testid="button-back"
        >
          Back
        </Button>
        
        <Card>
          <CardContent className="p-6">
            {!selectedIntent ? (
              <ContentIntentStep 
                selectedIntent={selectedIntent} 
                onSelect={(intent) => setSelectedIntent(intent)} 
              />
            ) : (
              <TopicSetupStep 
                onCreateTopic={handleCreateTopic}
                isCreating={createTopicMutation.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Editor</h1>
          <p className="text-muted-foreground">
            Review and approve AI-generated drafts
          </p>
        </div>
        
        <Button onClick={() => setShowSetup(true)} data-testid="button-new-topic">
          <Sparkles className="w-4 h-4 mr-2" />
          New Topic
        </Button>
      </div>

      {!hasTopics && !hasDrafts ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Welcome to Smart Editor</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start by creating your first topic. We'll automatically discover sources and generate drafts for you to review.
            </p>
            <Button onClick={() => setShowSetup(true)} data-testid="button-get-started">
              Get Started
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
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
                </Badge>
              ))}
            </div>
          )}

          <Tabs defaultValue="drafts" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="drafts" data-testid="tab-drafts">
                  Drafts
                  {filteredDrafts.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{filteredDrafts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
                <TabsTrigger value="published" data-testid="tab-published">Published</TabsTrigger>
              </TabsList>

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
            </div>

            <TabsContent value="drafts" className="space-y-4">
              {draftsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDrafts.length === 0 ? (
                <Card className="text-center py-8">
                  <CardContent>
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No drafts yet. Drafts will appear here as your topics process new content.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      onApprove={() => handleApprove(draft.id)}
                      onReject={() => handleReject(draft.id)}
                      onEdit={() => handleEdit(draft)}
                      isPending={updateDraftMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              <Card className="text-center py-8">
                <CardContent>
                  <Check className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Approved drafts ready for publishing will appear here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="published">
              <Card className="text-center py-8">
                <CardContent>
                  <ExternalLink className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Published content will appear here with links to your destinations.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
