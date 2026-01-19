import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Rss,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe,
  Trash2,
  ExternalLink,
  Clock,
  AlertCircle,
  Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import type { Source } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function SourcesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testingFeed, setTestingFeed] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [newSource, setNewSource] = useState({
    name: "",
    feedUrl: "",
    description: "",
    language: "en",
    fetchIntervalMinutes: 60,
  });
  const { toast } = useToast();

  const { data: sources, isLoading } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      setShowAddDialog(false);
      setNewSource({ name: "", feedUrl: "", description: "", language: "en", fetchIntervalMinutes: 60 });
      setTestResult(null);
      toast({ title: "Source added", description: "RSS source has been created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fetchMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/sources/${id}/fetch`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/source-items"] });
      toast({
        title: "Fetch complete",
        description: `Found ${data.itemsFound} items, added ${data.itemsAdded} new items`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Fetch failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({ title: "Source deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/sources/${id}`, { isActive: isActive ? "true" : "false" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/sources/seed-official"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({
        title: "Official sources added",
        description: `Added ${data.created} new sources, updated ${data.updated} existing sources`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error seeding sources", description: error.message, variant: "destructive" });
    },
  });

  const testFeed = async () => {
    if (!newSource.feedUrl) return;
    setTestingFeed(true);
    setTestResult(null);
    try {
      const result = await apiRequest("POST", "/api/sources/test-feed", { url: newSource.feedUrl }) as any;
      setTestResult(result);
      if (result.success && result.title && !newSource.name) {
        setNewSource((prev) => ({ ...prev, name: result.title }));
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    }
    setTestingFeed(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">News Sources</h1>
          <p className="text-sm text-muted-foreground">Monitor RSS feeds and discover content for automation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            data-testid="button-seed-sources"
          >
            {seedMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Add GCC Official Sources
          </Button>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-source">
              <Plus className="mr-2 h-4 w-4" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add RSS Source</DialogTitle>
              <DialogDescription>Add an RSS feed to monitor for new content</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="feedUrl">Feed URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="feedUrl"
                    placeholder="https://example.com/rss"
                    value={newSource.feedUrl}
                    onChange={(e) => setNewSource({ ...newSource, feedUrl: e.target.value })}
                    data-testid="input-feed-url"
                  />
                  <Button variant="outline" onClick={testFeed} disabled={testingFeed || !newSource.feedUrl} data-testid="button-test-feed">
                    {testingFeed ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                  </Button>
                </div>
                {testResult && (
                  <div className={`flex items-center gap-2 text-sm ${testResult.success ? "text-green-600" : "text-destructive"}`}>
                    {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.success ? `Valid feed: ${testResult.title} (${testResult.itemCount} items)` : testResult.error}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Source Name</Label>
                <Input
                  id="name"
                  placeholder="My News Feed"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  data-testid="input-source-name"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Technology news from..."
                  value={newSource.description}
                  onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                  data-testid="input-source-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Language</Label>
                  <Select value={newSource.language} onValueChange={(v) => setNewSource({ ...newSource, language: v })}>
                    <SelectTrigger data-testid="select-language">
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
                <div className="flex flex-col gap-2">
                  <Label>Fetch Interval</Label>
                  <Select
                    value={String(newSource.fetchIntervalMinutes)}
                    onValueChange={(v) => setNewSource({ ...newSource, fetchIntervalMinutes: parseInt(v) })}
                  >
                    <SelectTrigger data-testid="select-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">Every 15 min</SelectItem>
                      <SelectItem value="30">Every 30 min</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                      <SelectItem value="360">Every 6 hours</SelectItem>
                      <SelectItem value="1440">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(newSource)}
                disabled={!newSource.name || !newSource.feedUrl || createMutation.isPending}
                data-testid="button-save-source"
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Source
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {!sources || sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Rss className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <h3 className="font-medium">No sources configured</h3>
              <p className="text-sm text-muted-foreground">Add an RSS feed to start monitoring for content</p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-first-source">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <Card key={source.id} data-testid={`card-source-${source.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Rss className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{source.name}</CardTitle>
                      {source.description && (
                        <CardDescription className="text-xs">{source.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={source.isActive === "true"}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: source.id, isActive: checked })}
                    data-testid={`switch-source-${source.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="truncate">{source.feedUrl}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {source.itemCount || 0} items
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {source.language?.toUpperCase() || "EN"}
                  </Badge>
                  {source.lastError && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Error
                    </Badge>
                  )}
                </div>
                {source.lastFetchedAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last fetched {formatDistanceToNow(new Date(source.lastFetchedAt), { addSuffix: true })}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMutation.mutate(source.id)}
                    disabled={fetchMutation.isPending}
                    data-testid={`button-fetch-${source.id}`}
                  >
                    {fetchMutation.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3 w-3" />
                    )}
                    Fetch Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(source.feedUrl, "_blank")}
                    data-testid={`button-open-${source.id}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(source.id)}
                    data-testid={`button-delete-${source.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
