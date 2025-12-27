import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Target,
  Plus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Globe,
  Languages,
  Tag,
  Search,
  Rss,
  Star,
  Clock,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentGoal, DiscoveryJob, DiscoveredSource } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const CATEGORIES = [
  "Technology",
  "Business",
  "Science",
  "Health",
  "Sports",
  "Entertainment",
  "Politics",
  "Finance",
  "Education",
  "Travel",
];

const COUNTRIES = [
  { code: "us", name: "United States" },
  { code: "uk", name: "United Kingdom" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "eg", name: "Egypt" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "zh", name: "Chinese" },
];

interface WizardState {
  step: number;
  name: string;
  description: string;
  language: string;
  country: string;
  categories: string[];
  topics: string[];
  topicInput: string;
}

function ScoreBreakdown({ breakdown }: { breakdown: any }) {
  if (!breakdown) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {breakdown.languageMatch > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Languages className="h-3 w-3" />
          Lang +{breakdown.languageMatch}
        </Badge>
      )}
      {breakdown.freshness > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Fresh +{breakdown.freshness}
        </Badge>
      )}
      {breakdown.itemCount > 0 && (
        <Badge variant="secondary" className="gap-1">
          <BarChart3 className="h-3 w-3" />
          Items +{breakdown.itemCount}
        </Badge>
      )}
      {breakdown.domainQuality > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Star className="h-3 w-3" />
          Domain +{breakdown.domainQuality}
        </Badge>
      )}
    </div>
  );
}

function DiscoveryResults({ 
  jobId, 
  onClose 
}: { 
  jobId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  
  const { data, isLoading, refetch } = useQuery<{
    job: DiscoveryJob;
    sources: DiscoveredSource[];
  }>({
    queryKey: ["/api/discovery", jobId, "results"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.job?.status === "running" || data?.job?.status === "pending") {
        return 2000;
      }
      return false;
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (sourceId: string) => 
      apiRequest("POST", `/api/discovered-sources/${sourceId}/convert-to-source`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery", jobId, "results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Source added", description: "Feed has been added to your sources" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const job = data?.job;
  const sources = data?.sources || [];
  const validSources = sources.filter(s => s.status === "valid");
  const isRunning = job?.status === "running" || job?.status === "pending";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium">Discovery Results</h3>
          <p className="text-sm text-muted-foreground">
            {isRunning ? "Searching for RSS feeds..." : 
              `Found ${validSources.length} valid feeds from ${job?.candidatesFound || 0} candidates`}
          </p>
        </div>
        {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        {job?.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {job?.status === "failed" && <AlertCircle className="h-5 w-5 text-destructive" />}
      </div>

      {isRunning && (
        <Progress value={job?.candidatesFound ? 50 : 25} className="h-2" />
      )}

      {validSources.length > 0 && (
        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
          {validSources.map((source) => (
            <Card key={source.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Rss className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {source.feedTitle || source.domain}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        Score: {source.score}
                      </Badge>
                    </div>
                    
                    {source.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {source.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {source.domain}
                      </span>
                      {(source.itemCount ?? 0) > 0 && (
                        <span>{source.itemCount} items</span>
                      )}
                      {source.lastPublishDate && (
                        <span>
                          Updated {formatDistanceToNow(new Date(source.lastPublishDate))} ago
                        </span>
                      )}
                    </div>

                    <ScoreBreakdown breakdown={source.scoreBreakdown} />
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {source.status === "added" ? (
                      <Badge className="bg-green-500/15 text-green-600 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Added
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => convertMutation.mutate(source.id)}
                        disabled={convertMutation.isPending}
                        data-testid={`btn-add-source-${source.id}`}
                      >
                        {convertMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    )}
                    <a
                      href={source.feedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Feed
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isRunning && validSources.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Search className="h-8 w-8 mb-2" />
          <p>No valid feeds found</p>
          <p className="text-sm">Try adjusting your categories or topics</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose} data-testid="btn-close-results">
          Close
        </Button>
      </div>
    </div>
  );
}

export default function ContentGoalsPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<WizardState>({
    step: 1,
    name: "",
    description: "",
    language: "en",
    country: "",
    categories: [],
    topics: [],
    topicInput: "",
  });
  const { toast } = useToast();

  const { data: goals, isLoading } = useQuery<ContentGoal[]>({
    queryKey: ["/api/content-goals"],
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/content-goals", data);
      return response as unknown as ContentGoal;
    },
    onSuccess: (goal: ContentGoal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-goals"] });
      toast({ title: "Goal created", description: "Starting discovery..." });
      startDiscovery(goal.id);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const startDiscoveryMutation = useMutation({
    mutationFn: async (contentGoalId: string) => 
      apiRequest("POST", "/api/discovery/run", { contentGoalId }),
    onSuccess: (data: any) => {
      setActiveJobId(data.jobId);
      setShowWizard(false);
      resetWizard();
    },
    onError: (error: any) => {
      toast({ title: "Discovery failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/content-goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-goals"] });
      toast({ title: "Goal deleted" });
    },
  });

  const startDiscovery = (goalId: string) => {
    startDiscoveryMutation.mutate(goalId);
  };

  const resetWizard = () => {
    setWizard({
      step: 1,
      name: "",
      description: "",
      language: "en",
      country: "",
      categories: [],
      topics: [],
      topicInput: "",
    });
  };

  const toggleCategory = (cat: string) => {
    setWizard((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const addTopic = () => {
    if (wizard.topicInput.trim()) {
      setWizard((prev) => ({
        ...prev,
        topics: [...prev.topics, prev.topicInput.trim()],
        topicInput: "",
      }));
    }
  };

  const removeTopic = (topic: string) => {
    setWizard((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topic),
    }));
  };

  const handleCreate = () => {
    createGoalMutation.mutate({
      workspaceId: "demo-workspace",
      name: wizard.name,
      description: wizard.description || undefined,
      language: wizard.language,
      country: wizard.country || undefined,
      categories: wizard.categories,
      topics: wizard.topics,
    });
  };

  const canProceed = () => {
    switch (wizard.step) {
      case 1:
        return wizard.name.trim().length > 0;
      case 2:
        return wizard.categories.length > 0 || wizard.topics.length > 0;
      default:
        return true;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6" />
            Content Goals
          </h1>
          <p className="text-muted-foreground">
            Define your content needs and discover relevant RSS sources automatically
          </p>
        </div>
        <Dialog open={showWizard} onOpenChange={setShowWizard}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-goal">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Content Goal</DialogTitle>
              <DialogDescription>
                Step {wizard.step} of 2: {wizard.step === 1 ? "Define your goal" : "Select topics"}
              </DialogDescription>
            </DialogHeader>

            {wizard.step === 1 && (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="goal-name">Goal Name</Label>
                  <Input
                    id="goal-name"
                    placeholder="e.g., Tech Industry News"
                    value={wizard.name}
                    onChange={(e) => setWizard((prev) => ({ ...prev, name: e.target.value }))}
                    data-testid="input-goal-name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="goal-desc">Description (optional)</Label>
                  <Textarea
                    id="goal-desc"
                    placeholder="What kind of content are you looking for?"
                    value={wizard.description}
                    onChange={(e) => setWizard((prev) => ({ ...prev, description: e.target.value }))}
                    className="resize-none"
                    rows={3}
                    data-testid="input-goal-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Language</Label>
                    <Select
                      value={wizard.language}
                      onValueChange={(v) => setWizard((prev) => ({ ...prev, language: v }))}
                    >
                      <SelectTrigger data-testid="select-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Country (optional)</Label>
                    <Select
                      value={wizard.country}
                      onValueChange={(v) => setWizard((prev) => ({ ...prev, country: v }))}
                    >
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {wizard.step === 2 && (
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <Badge
                        key={cat}
                        variant={wizard.categories.includes(cat) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCategory(cat)}
                        data-testid={`badge-category-${cat.toLowerCase()}`}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Custom Topics</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a topic..."
                      value={wizard.topicInput}
                      onChange={(e) => setWizard((prev) => ({ ...prev, topicInput: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                      data-testid="input-topic"
                    />
                    <Button type="button" variant="secondary" onClick={addTopic} data-testid="btn-add-topic">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {wizard.topics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {wizard.topics.map((topic) => (
                        <Badge key={topic} variant="secondary" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {topic}
                          <button
                            type="button"
                            onClick={() => removeTopic(topic)}
                            className="ml-1 hover:text-destructive"
                          >
                            &times;
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              {wizard.step > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => setWizard((prev) => ({ ...prev, step: prev.step - 1 }))}
                  data-testid="btn-wizard-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}
              
              {wizard.step < 2 ? (
                <Button
                  onClick={() => setWizard((prev) => ({ ...prev, step: prev.step + 1 }))}
                  disabled={!canProceed()}
                  data-testid="btn-wizard-next"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={!canProceed() || createGoalMutation.isPending}
                  data-testid="btn-wizard-create"
                >
                  {createGoalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Create & Discover
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeJobId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Discovery in Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <DiscoveryResults 
              jobId={activeJobId} 
              onClose={() => setActiveJobId(null)} 
            />
          </CardContent>
        </Card>
      )}

      {goals && goals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <Card key={goal.id} className="group">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{goal.name}</CardTitle>
                  {goal.description && (
                    <CardDescription className="line-clamp-2">
                      {goal.description}
                    </CardDescription>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => deleteGoalMutation.mutate(goal.id)}
                  data-testid={`btn-delete-goal-${goal.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="gap-1">
                    <Languages className="h-3 w-3" />
                    {LANGUAGES.find((l) => l.code === goal.language)?.name || goal.language}
                  </Badge>
                  {goal.country && (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="h-3 w-3" />
                      {COUNTRIES.find((c) => c.code === goal.country)?.name || goal.country}
                    </Badge>
                  )}
                </div>
                {goal.categories && goal.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {goal.categories.slice(0, 3).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                    {goal.categories.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{goal.categories.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => startDiscovery(goal.id)}
                  disabled={startDiscoveryMutation.isPending}
                  data-testid={`btn-discover-${goal.id}`}
                >
                  {startDiscoveryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Run Discovery
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Content Goals Yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create your first content goal to automatically discover relevant RSS feeds for your topics
            </p>
            <Button onClick={() => setShowWizard(true)} data-testid="btn-create-first-goal">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
