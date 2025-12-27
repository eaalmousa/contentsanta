import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, Gift, Sparkles, FileText, Zap, Users } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import ContentLibrary from "@/pages/content-library";
import CreateContent from "@/pages/create-content";
import Workflows from "@/pages/workflows";
import Templates from "@/pages/templates";
import Publishing from "@/pages/publishing";
import Usage from "@/pages/usage";
import Team from "@/pages/team";
import BrandVoice from "@/pages/brand-voice";
import Settings from "@/pages/settings";
import AdminDashboard from "@/pages/admin";
import Sources from "@/pages/sources";
import Inbox from "@/pages/inbox";
import Automations from "@/pages/automations";
import ContentGoals from "@/pages/content-goals";
import SmartEditor from "@/pages/smart-editor";
import Topics from "@/pages/topics";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SmartEditor} />
      <Route path="/topics" component={Topics} />
      <Route path="/library" component={ContentLibrary} />
      <Route path="/publishing" component={Publishing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create" component={CreateContent} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/templates" component={Templates} />
      <Route path="/usage" component={Usage} />
      <Route path="/team" component={Team} />
      <Route path="/brand" component={BrandVoice} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/sources" component={Sources} />
      <Route path="/inbox" component={Inbox} />
      <Route path="/automations" component={Automations} />
      <Route path="/content-goals" component={ContentGoals} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <Gift className="h-8 w-8 text-primary" />
            <span className="font-serif text-2xl font-bold">Content Santa</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a href="/api/login">
              <Button data-testid="button-login">Sign In</Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="font-serif text-5xl font-bold tracking-tight sm:text-6xl">
            AI-Powered Content
            <br />
            <span className="text-primary">That Delivers</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Transform raw content into ready-to-publish assets with intelligent workflows. 
            From SEO blogs to social packs, Content Santa handles it all.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href="/api/login">
              <Button size="lg" data-testid="button-get-started">
                <Sparkles className="mr-2 h-5 w-5" />
                Get Started Free
              </Button>
            </a>
          </div>
        </section>

        <section className="border-t bg-muted/50 py-24">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center font-serif text-3xl font-bold">
              Everything You Need
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<FileText className="h-8 w-8" />}
                title="Content Ingestion"
                description="Import from URLs, paste text, upload PDFs, or create briefs. All your content in one place."
              />
              <FeatureCard
                icon={<Zap className="h-8 w-8" />}
                title="AI Workflows"
                description="Run powerful workflows: SEO blogs, press releases, social packs, translations, and more."
              />
              <FeatureCard
                icon={<Users className="h-8 w-8" />}
                title="Team Collaboration"
                description="Review, approve, and publish content with your team. Full version history included."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Content Santa - AI-powered content management platform
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-background p-6">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function AuthenticatedApp() {
  const { user, logout, isLoggingOut } = useAuth();

  const sidebarStyle = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2">
                  {user.profileImageUrl && (
                    <img 
                      src={user.profileImageUrl} 
                      alt={user.firstName || "User"} 
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {user.firstName || user.email}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    data-testid="button-logout"
                  >
                    {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out"}
                  </Button>
                </div>
              )}
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="content-santa-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
