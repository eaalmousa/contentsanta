import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceContext } from "@/hooks/use-workspace-context";
import { Globe, Target, PlayCircle, Settings as SettingsIcon, BarChart3, CheckCircle2, Circle } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function StartHerePage() {
  const { sites, counts, isLoading } = useWorkspaceContext();
  const [, navigate] = useLocation();

  // Debug: Track component mount/unmount
  useEffect(() => {
    console.log("[StartHere] mount");
    return () => console.log("[StartHere] unmount");
  }, []);

  // Debug: Track component render
  console.log("[StartHere] render", { 
    isLoading, 
    hasCounts: !!counts,
    hasPublishing: (counts?.targetsCount || 0) > 0,
    hasTopics: (counts?.topicsCount || 0) > 0
  });

  const hasPublishing = (counts?.targetsCount || 0) > 0;
  const hasTopics = (counts?.topicsCount || 0) > 0;

  const steps = [
    {
      number: 0,
      title: "Configure Publishing",
      description: "Add your WordPress site or other publishing channels. Topics unlock only after a publishing target is configured.",
      icon: Globe,
      completed: hasPublishing,
      action: () => navigate("/publishing"),
      actionLabel: hasPublishing ? "Manage Publishing" : "Configure Publishing",
      status: hasPublishing ? `${counts?.targetsCount} target(s) configured` : "Not started",
    },
    {
      number: 1,
      title: "Create Topics",
      description: "Define topic + region + rules. Each topic runs independently and stores run history.",
      icon: Target,
      completed: hasTopics,
      disabled: !hasPublishing,
      action: () => navigate("/topics"),
      actionLabel: hasTopics ? "Manage Topics" : "Create Topic",
      status: hasTopics ? `${counts?.topicsCount} topic(s)` : hasPublishing ? "Ready" : "Locked",
    },
    {
      number: 2,
      title: "Discovery Runs",
      description: "Fetch sources, dedupe inflation, score, and create pipeline items. Runs activate when you toggle topics live.",
      icon: PlayCircle,
      completed: false, // Could check for actual runs
      disabled: !hasTopics,
      action: () => navigate("/pipeline"),
      actionLabel: "View Pipeline",
      status: hasTopics ? "Active" : "Waiting for topics",
    },
    {
      number: 3,
      title: "Publishing Settings",
      description: "Configure WordPress connection, default post status, categories, and author mapping.",
      icon: SettingsIcon,
      completed: false, // Could check for publishing targets
      disabled: !hasPublishing,
      action: () => navigate("/publishing"),
      actionLabel: "Configure Publishing",
      status: hasPublishing ? "Ready" : "Locked",
    },
    {
      number: 4,
      title: "Analytics & Monitoring",
      description: "View run history, output volume, publish success rate, and dedupe metrics per topic.",
      icon: BarChart3,
      completed: false,
      disabled: !hasTopics,
      action: () => navigate("/analytics"),
      actionLabel: "View Analytics",
      status: hasTopics ? "Available" : "Waiting for activity",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome to Content Santa</h1>
          <p className="text-lg text-muted-foreground">
            Turn topics into publish-ready stories — automatically. Follow these steps to get started.
          </p>
        </div>

        {!hasPublishing && (
          <Card className="mb-8 border-blue-500 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-blue-900 dark:text-blue-100">Start Here</CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                Configure your first publishing target to unlock the full platform
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="space-y-6">
          {steps.map((step) => {
            const Icon = step.icon;
            const isDisabled = step.disabled;

            return (
              <Card
                key={step.number}
                className={`transition-all ${
                  isDisabled ? "opacity-50" : "hover:shadow-lg"
                } ${step.completed ? "border-green-500" : ""}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`rounded-full p-3 ${
                          step.completed
                            ? "bg-green-100 dark:bg-green-900"
                            : isDisabled
                            ? "bg-gray-100 dark:bg-gray-800"
                            : "bg-primary/10"
                        }`}
                      >
                        <Icon
                          className={`h-6 w-6 ${
                            step.completed
                              ? "text-green-600 dark:text-green-400"
                              : isDisabled
                              ? "text-gray-400"
                              : "text-primary"
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl">
                            Step {step.number}: {step.title}
                          </CardTitle>
                          {step.completed && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Complete
                            </Badge>
                          )}
                          {!step.completed && !isDisabled && (
                            <Badge variant="outline">
                              <Circle className="h-3 w-3 mr-1" />
                              {step.status}
                            </Badge>
                          )}
                          {isDisabled && (
                            <Badge variant="secondary">
                              {step.status}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-base">
                          {step.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={step.action}
                      disabled={isDisabled}
                      variant={step.completed ? "outline" : "default"}
                    >
                      {step.actionLabel}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8 bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">No manual juggling</CardTitle>
            <CardDescription>
              The system runs on activation and stays observable. View run history, active job status,
              and dedupe metrics for every topic. All automation is auditable.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
