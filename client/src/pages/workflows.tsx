import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation, Link } from "wouter";
import {
  Sparkles,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ArrowRight,
  Plus,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Input, WorkflowType, WorkflowRun, Asset } from "@shared/schema";
import { workflowMeta, workflowTypes } from "@shared/schema";

function WorkflowCard({
  type,
  selected,
  onClick,
}: {
  type: WorkflowType;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = workflowMeta[type];
  const IconComponent = (LucideIcons as any)[meta.icon] || Sparkles;

  return (
    <Card
      className={`cursor-pointer transition-all ${
        selected ? "ring-2 ring-primary" : "hover-elevate"
      }`}
      onClick={onClick}
      data-testid={`card-workflow-${type}`}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            selected ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{meta.label}</h3>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InputSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: inputs, isLoading } = useQuery<Input[]>({
    queryKey: ["/api/inputs"],
  });

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!inputs || inputs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/50" />
        <div className="flex flex-col gap-1">
          <span className="font-medium">No content available</span>
          <span className="text-sm text-muted-foreground">
            Create content first to run workflows
          </span>
        </div>
        <Link href="/create">
          <Button size="sm" data-testid="button-create-content-cta">
            <Plus className="mr-2 h-4 w-4" />
            Create Content
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Select value={selectedId || ""} onValueChange={onSelect}>
      <SelectTrigger className="w-full" data-testid="select-input">
        <SelectValue placeholder="Select content to transform" />
      </SelectTrigger>
      <SelectContent>
        {inputs.map((input) => (
          <SelectItem key={input.id} value={input.id}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase">
                {input.type}
              </Badge>
              <span className="truncate">{input.title}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RunHistory({ inputId }: { inputId: string | null }) {
  const { data: runs, isLoading } = useQuery<WorkflowRun[]>({
    queryKey: ["/api/workflow-runs", { inputId }],
    enabled: !!inputId,
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["/api/assets", { inputId }],
    enabled: !!inputId,
  });

  if (!inputId) {
    return (
      <div className="flex h-full items-center justify-center text-center text-muted-foreground">
        <p>Select content to see workflow history</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Clock className="h-10 w-10 opacity-50" />
        <p>No workflows run yet for this content</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="flex flex-col gap-2 p-2">
        {runs.map((run) => {
          const meta = workflowMeta[run.workflowType as WorkflowType];
          const asset = assets?.find((a) => a.runId === run.id);

          return (
            <div
              key={run.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                {run.status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : run.status === "running" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : run.status === "failed" ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{meta?.label || run.workflowType}</span>
                  <span className="text-xs text-muted-foreground">
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleString()
                      : "Pending"}
                  </span>
                </div>
              </div>
              {asset && (
                <Badge variant="secondary" className="text-xs">
                  Asset created
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default function Workflows() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialInputId = urlParams.get("inputId");

  const [selectedInputId, setSelectedInputId] = useState<string | null>(initialInputId);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (initialInputId) {
      setSelectedInputId(initialInputId);
    }
  }, [initialInputId]);

  const { data: selectedInput } = useQuery<Input>({
    queryKey: ["/api/inputs", selectedInputId],
    enabled: !!selectedInputId,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInputId || !selectedWorkflow) {
        throw new Error("Please select content and a workflow");
      }
      const res = await apiRequest("POST", "/api/workflow-runs", {
        workspaceId: "default",
        inputId: selectedInputId,
        workflowType: selectedWorkflow,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Workflow started",
        description: "Your content is being processed. Results will appear shortly.",
      });
      setSelectedWorkflow(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Workflow failed",
        description: error.message || "Failed to run workflow. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-bold" data-testid="text-workflows-title">
          AI Workflows
        </h1>
        <p className="text-muted-foreground">
          Transform your content with powerful AI-powered workflows.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Content Selection & Workflow Selection */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Content Selection */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-lg">Select Content</CardTitle>
              <CardDescription>
                Choose the content you want to transform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InputSelector
                selectedId={selectedInputId}
                onSelect={setSelectedInputId}
              />
              {selectedInput && (
                <div className="mt-4 rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{selectedInput.title}</span>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {selectedInput.rawText?.slice(0, 150)}
                        {selectedInput.rawText && selectedInput.rawText.length > 150 ? "..." : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs uppercase">
                          {selectedInput.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs uppercase">
                          {selectedInput.language}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workflow Selection */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-lg">Choose Workflow</CardTitle>
              <CardDescription>
                Select an AI workflow to apply to your content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {workflowTypes.map((type) => (
                  <WorkflowCard
                    key={type}
                    type={type}
                    selected={selectedWorkflow === type}
                    onClick={() => setSelectedWorkflow(type)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Run Button */}
          <Button
            size="lg"
            className="w-full"
            disabled={!selectedInputId || !selectedWorkflow || runMutation.isPending}
            onClick={() => runMutation.mutate()}
            data-testid="button-run-workflow"
          >
            {runMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Run Workflow
              </>
            )}
          </Button>
        </div>

        {/* Right Column - Run History */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="font-serif text-lg">Run History</CardTitle>
            <CardDescription>
              Previous workflow runs for selected content
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RunHistory inputId={selectedInputId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
