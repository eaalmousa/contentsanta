import { useState } from "react";
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
import type { Topic, ContentIntent } from "@shared/schema";
import { Link } from "wouter";

const contentIntentConfig: Record<ContentIntent, { label: string; icon: any; color: string }> = {
  news_monitoring: { label: "News", icon: Globe, color: "bg-blue-500" },
  informational: { label: "Info", icon: BookOpen, color: "bg-green-500" },
  evergreen: { label: "Evergreen", icon: FileText, color: "bg-amber-500" },
  mixed: { label: "Mixed", icon: Shuffle, color: "bg-purple-500" },
};

function TopicCard({ 
  topic, 
  onToggleLive,
  onDelete,
  isPending
}: { 
  topic: Topic;
  onToggleLive: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const intent = contentIntentConfig[topic.contentIntent as ContentIntent] || contentIntentConfig.mixed;
  const IntentIcon = intent.icon;
  const isLive = topic.isLive === "true";

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
              <DropdownMenuItem data-testid={`menu-edit-${topic.id}`}>
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {topic.language || "en"}
            </Badge>
            {topic.outputVolumePerDay && (
              <Badge variant="outline" className="text-xs">
                {topic.outputVolumePerDay}/day
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
    </div>
  );
}
