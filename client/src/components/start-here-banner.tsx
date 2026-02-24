import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Globe, ArrowRight } from "lucide-react";
import { useWorkspaceContext } from "@/hooks/use-workspace-context";
import { useLocation } from "wouter";

/**
 * Sticky banner shown when no WordPress targets/sites exist
 * Guides users to connect their first website
 */
export function StartHereBanner() {
  const { counts, isLoading } = useWorkspaceContext();
  const [, navigate] = useLocation();

  // Don't show if loading or if WordPress targets exist
  if (isLoading || (counts && counts.targetsCount > 0)) {
    return null;
  }

  return (
    <Alert className="mb-6 border-blue-600 bg-blue-50 dark:bg-blue-950">
      <Globe className="h-5 w-5 text-blue-600" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-100">
            Connect a website to unlock Topics, Pipeline, and Publishing
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Sites are the foundation of your content automation. Start by connecting your first website.
          </p>
        </div>
        <Button
          onClick={() => navigate("/publishing")}
          className="bg-blue-600 hover:bg-blue-700 flex-shrink-0"
        >
          Connect Website
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
