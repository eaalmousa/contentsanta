import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Zap,
  Plus,
  Play,
  Loader2,
  Settings,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  History,
  ArrowRight,
  Target,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Automation, AutomationRun, Source, PublishingTarget } from "@shared/schema";
import { workflowMeta, workflowTypes, type WorkflowType } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

export default function AutomationsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [newAutomation, setNewAutomation] = useState({
    name: "",
    description: "",
    triggerType: "on_new_items" as const,
    sourceIds: [] as string[],
    filterKeywordsInclude: [] as string[],
    filterKeywordsExclude: [] as string[],
    workflowType: "seo_blog" as WorkflowType,
    approvalRequired: "true",
    autoPublish: "false",
    publishingTargetId: "",
    runLimitPerCycle: 10,
  });
  const [keywordInput, setKeywordInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const { toast } = useToast();

  const { data: automations, isLoading } = useQuery<Automation[]>({
    queryKey: ["/api/automations"],
  });

  const { data: sources } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const { data: targets } = useQuery<PublishingTarget[]>({
    queryKey: ["/api/publishing-targets", { workspaceId: "demo-workspace" }],
    queryFn: () => fetch("/api/publishing-targets?workspaceId=demo-workspace").then(r => r.json()),
  });

  const { data: runs } = useQuery<AutomationRun[]>({
    queryKey: [`/api/automations/${selectedAutomation?.id}/runs`],
    enabled: !!selectedAutomation,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/automations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Automation created", description: "Your automation is ready to run" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const invalidateSourceItems = () => {
    queryClient.invalidateQueries({ predicate: (query) => 
      typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("/api/source-items")
    });
  };

  const runMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/automations/${id}/run`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      invalidateSourceItems();
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "Automation completed",
        description: `Processed ${data.itemsProcessed} items, ${data.itemsSucceeded} succeeded`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/automations/${id}`, { isActive: isActive ? "true" : "false" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/automations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      setSelectedAutomation(null);
      toast({ title: "Automation deleted" });
    },
  });

  const resetForm = () => {
    setNewAutomation({
      name: "",
      description: "",
      triggerType: "on_new_items",
      sourceIds: [],
      filterKeywordsInclude: [],
      filterKeywordsExclude: [],
      workflowType: "seo_blog",
      approvalRequired: "true",
      autoPublish: "false",
      publishingTargetId: "",
      runLimitPerCycle: 10,
    });
    setKeywordInput("");
    setExcludeInput("");
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setNewAutomation({
        ...newAutomation,
        filterKeywordsInclude: [...newAutomation.filterKeywordsInclude, keywordInput.trim()],
      });
      setKeywordInput("");
    }
  };

  const addExcludeKeyword = () => {
    if (excludeInput.trim()) {
      setNewAutomation({
        ...newAutomation,
        filterKeywordsExclude: [...newAutomation.filterKeywordsExclude, excludeInput.trim()],
      });
      setExcludeInput("");
    }
  };

  const wordpressTargets = targets?.filter((t) => t.type === "wordpress") || [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
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
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Create automated pipelines to generate and publish content
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-automation">
              <Plus className="mr-2 h-4 w-4" />
              Create Automation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Automation</DialogTitle>
              <DialogDescription>
                Set up an automated pipeline to process news and generate content
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basics" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
                <TabsTrigger value="publish">Publish</TabsTrigger>
              </TabsList>

              <TabsContent value="basics" className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <Label>Automation Name</Label>
                  <Input
                    placeholder="Daily Tech News to Blog"
                    value={newAutomation.name}
                    onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                    data-testid="input-automation-name"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe what this automation does..."
                    value={newAutomation.description}
                    onChange={(e) => setNewAutomation({ ...newAutomation, description: e.target.value })}
                    data-testid="input-automation-description"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Trigger Type</Label>
                  <Select
                    value={newAutomation.triggerType}
                    onValueChange={(v: any) => setNewAutomation({ ...newAutomation, triggerType: v })}
                  >
                    <SelectTrigger data-testid="select-trigger-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_new_items">On New Items</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Items per Run</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={newAutomation.runLimitPerCycle}
                    onChange={(e) =>
                      setNewAutomation({ ...newAutomation, runLimitPerCycle: parseInt(e.target.value) || 10 })
                    }
                    data-testid="input-run-limit"
                  />
                </div>
              </TabsContent>

              <TabsContent value="sources" className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <Label>Select Sources</Label>
                  <div className="flex flex-wrap gap-2">
                    {sources?.map((source) => (
                      <Badge
                        key={source.id}
                        variant={newAutomation.sourceIds.includes(source.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const ids = newAutomation.sourceIds.includes(source.id)
                            ? newAutomation.sourceIds.filter((id) => id !== source.id)
                            : [...newAutomation.sourceIds, source.id];
                          setNewAutomation({ ...newAutomation, sourceIds: ids });
                        }}
                        data-testid={`badge-source-${source.id}`}
                      >
                        {source.name}
                      </Badge>
                    ))}
                    {!sources?.length && (
                      <p className="text-sm text-muted-foreground">
                        No sources available.{" "}
                        <Link href="/sources" className="text-primary underline">
                          Add sources first
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Include Keywords (content must contain)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add keyword..."
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                      data-testid="input-include-keyword"
                    />
                    <Button variant="outline" onClick={addKeyword}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newAutomation.filterKeywordsInclude.map((kw, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() =>
                          setNewAutomation({
                            ...newAutomation,
                            filterKeywordsInclude: newAutomation.filterKeywordsInclude.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        {kw} x
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Exclude Keywords (skip if contains)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add keyword to exclude..."
                      value={excludeInput}
                      onChange={(e) => setExcludeInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addExcludeKeyword()}
                      data-testid="input-exclude-keyword"
                    />
                    <Button variant="outline" onClick={addExcludeKeyword}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newAutomation.filterKeywordsExclude.map((kw, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() =>
                          setNewAutomation({
                            ...newAutomation,
                            filterKeywordsExclude: newAutomation.filterKeywordsExclude.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        {kw} x
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <Label>AI Workflow</Label>
                  <Select
                    value={newAutomation.workflowType}
                    onValueChange={(v: WorkflowType) => setNewAutomation({ ...newAutomation, workflowType: v })}
                  >
                    <SelectTrigger data-testid="select-workflow-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workflowTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {workflowMeta[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {workflowMeta[newAutomation.workflowType].description}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Approval</Label>
                    <p className="text-xs text-muted-foreground">Content goes to review before publishing</p>
                  </div>
                  <Switch
                    checked={newAutomation.approvalRequired === "true"}
                    onCheckedChange={(v) =>
                      setNewAutomation({ ...newAutomation, approvalRequired: v ? "true" : "false" })
                    }
                    data-testid="switch-approval-required"
                  />
                </div>
              </TabsContent>

              <TabsContent value="publish" className="flex flex-col gap-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Publish</Label>
                    <p className="text-xs text-muted-foreground">Automatically publish when ready</p>
                  </div>
                  <Switch
                    checked={newAutomation.autoPublish === "true"}
                    onCheckedChange={(v) =>
                      setNewAutomation({ ...newAutomation, autoPublish: v ? "true" : "false" })
                    }
                    data-testid="switch-auto-publish"
                  />
                </div>
                {newAutomation.autoPublish === "true" && (
                  <div className="flex flex-col gap-2">
                    <Label>WordPress Target</Label>
                    <Select
                      value={newAutomation.publishingTargetId}
                      onValueChange={(v) => setNewAutomation({ ...newAutomation, publishingTargetId: v })}
                    >
                      <SelectTrigger data-testid="select-publishing-target">
                        <SelectValue placeholder="Select WordPress site" />
                      </SelectTrigger>
                      <SelectContent>
                        {wordpressTargets.map((target) => (
                          <SelectItem key={target.id} value={target.id}>
                            {target.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!wordpressTargets.length && (
                      <p className="text-xs text-muted-foreground">
                        No WordPress targets configured.{" "}
                        <Link href="/publishing" className="text-primary underline">
                          Add a target
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(newAutomation)}
                disabled={!newAutomation.name || createMutation.isPending}
                data-testid="button-save-automation"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Automation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!automations || automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Zap className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <h3 className="font-medium">No automations yet</h3>
              <p className="text-sm text-muted-foreground">
                Create an automation to process content automatically
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} data-testid="button-create-first-automation">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {automations.map((automation) => (
            <Card
              key={automation.id}
              className={`cursor-pointer transition-all ${
                selectedAutomation?.id === automation.id ? "ring-2 ring-primary" : "hover-elevate"
              }`}
              onClick={() => setSelectedAutomation(automation)}
              data-testid={`card-automation-${automation.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        automation.isActive === "true" ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <Zap
                        className={`h-4 w-4 ${
                          automation.isActive === "true" ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <CardTitle className="text-base">{automation.name}</CardTitle>
                      {automation.description && (
                        <CardDescription className="text-xs line-clamp-1">{automation.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={automation.isActive === "true"}
                    onCheckedChange={(checked) => {
                      toggleMutation.mutate({ id: automation.id, isActive: checked });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`switch-automation-${automation.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {workflowMeta[automation.workflowType as WorkflowType]?.label || automation.workflowType}
                  </Badge>
                  {automation.approvalRequired === "true" && (
                    <Badge variant="secondary" className="text-xs">
                      Approval Required
                    </Badge>
                  )}
                  {automation.autoPublish === "true" && (
                    <Badge variant="default" className="text-xs">
                      Auto-Publish
                    </Badge>
                  )}
                </div>
                {automation.lastRunAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last run {formatDistanceToNow(new Date(automation.lastRunAt), { addSuffix: true })}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    onClick={() => runMutation.mutate(automation.id)}
                    disabled={runMutation.isPending}
                    data-testid={`button-run-${automation.id}`}
                  >
                    {runMutation.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-3 w-3" />
                    )}
                    Run Now
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(automation.id)}
                    data-testid={`button-delete-${automation.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedAutomation && runs && runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Run History: {selectedAutomation.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {runs.slice(0, 10).map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  data-testid={`run-${run.id}`}
                >
                  <div className="flex items-center gap-3">
                    {run.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : run.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {run.itemsSucceeded}/{run.itemsProcessed} items processed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.createdAt && format(new Date(run.createdAt), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={run.status === "completed" ? "outline" : run.status === "failed" ? "destructive" : "secondary"}>
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
