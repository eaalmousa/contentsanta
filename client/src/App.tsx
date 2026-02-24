import { Switch, Route, useLocation, Redirect } from "wouter";
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
import { Loader2, Gift, Globe, Target, TrendingUp, Workflow, CheckCircle2, BarChart3, Sparkles } from "lucide-react";
import { sanitizeImageUrl } from "@/lib/image-utils";
import { motion, AnimatePresence } from "framer-motion";

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
import Topics from "@/pages/topics";
import Pipeline from "@/pages/pipeline";
import Analytics from "@/pages/analytics";
import StartHere from "@/pages/start-here";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/"><Redirect to="/start-here" /></Route>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/start-here" component={StartHere} />
      <Route path="/sites"><Redirect to="/publishing" /></Route>
      <Route path="/topics" component={Topics} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/analytics" component={Analytics} />
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
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      {/* Dynamic Background Gradients */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px] animate-float" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Gift className="h-8 w-8 text-primary transition-transform group-hover:rotate-12" />
              <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-400 animate-pulse" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              ContentSanta
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a href="/login">
              <Button variant="ghost" className="hover:bg-primary/10">Sign In</Button>
            </a>
            <a href="/signup">
              <Button className="bg-primary/90 hover:bg-primary shadow-lg shadow-primary/25">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-24 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary mb-6 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              The Magical AI Content Engine
            </div>
            <h1 className="font-display text-5xl font-bold tracking-tight sm:text-7xl mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50 pb-2">
              Turn topics into stories
              <br />
              <span className="text-primary bg-clip-text">automatically.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground leading-relaxed">
              Connect your website. Define your markets. ContentSanta magically discovers coverage,
              deduplicates noise, and queues publish-ready stories for your review.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="/signup">
                <Button size="lg" className="h-12 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_40px_-10px_rgba(var(--primary),0.5)] transition-all hover:scale-105">
                  <Globe className="mr-2 h-5 w-5" />
                  Connect a Website
                </Button>
              </a>
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg rounded-full border-primary/20 hover:bg-primary/5 backdrop-blur-sm transition-all hover:scale-105" onClick={() => {
                document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" });
              }}>
                See Magic
              </Button>
            </div>
          </motion.div>

          {/* Floating UI Elements Demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-20 relative mx-auto max-w-5xl rounded-xl border border-border/50 bg-background/40 backdrop-blur-md shadow-2xl overflow-hidden p-2"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            <div className="rounded-lg bg-card/50 p-8 grid gap-4 grid-cols-1 md:grid-cols-3 border border-border/50">
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/50 border border-border/50">
                <Target className="h-8 w-8 text-blue-400" />
                <div className="font-medium">Topic Discovery</div>
                <div className="h-2 w-24 bg-primary/20 rounded-full mt-2 overflow-hidden">
                  <div className="h-full w-2/3 bg-primary animate-shimmer" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/50 border border-border/50 scale-110 shadow-lg border-primary/30 z-10">
                <Sparkles className="h-8 w-8 text-primary" />
                <div className="font-medium">AI Processing</div>
                <div className="text-xs text-muted-foreground">Analysing 500+ sources...</div>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/50 border border-border/50">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <div className="font-medium">Publish Ready</div>
                <div className="h-8 w-20 bg-green-500/10 text-green-500 rounded flex items-center justify-center text-xs font-bold">
                  Published
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="relative border-t border-border/40 py-24 overflow-hidden">
          <div className="absolute inset-0 bg-secondary/30" />
          <div className="container mx-auto px-4 relative">
            <h2 className="mb-4 text-center font-display text-4xl font-bold">
              How the Magic Happens
            </h2>
            <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
              A frictionless workflow designed for autonomous content operations.
            </p>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              <WorkflowCard
                step="0"
                icon={<Globe className="h-6 w-6" />}
                title="Connect"
                delay={0.1}
                description="Link your WordPress or CMS. Topics unlock instantly."
              />
              <WorkflowCard
                step="1"
                icon={<Target className="h-6 w-6" />}
                title="Define"
                delay={0.2}
                description="Set your Topics & Regions. The AI begins scanning."
              />
              <WorkflowCard
                step="2"
                icon={<Sparkles className="h-6 w-6" />}
                title="Discover"
                delay={0.3}
                description="Fetcher finds, dedupes, and scores global coverage."
              />
              <WorkflowCard
                step="3"
                icon={<Workflow className="h-6 w-6" />}
                title="Publish"
                delay={0.4}
                description="Review the smart pipeline and publish with one click."
              />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="border-t border-border/40 py-24 bg-card/30">
          <div className="container mx-auto px-4">
            <h2 className="mb-16 text-center font-display text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
              Built for Modern Content Ops
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              <FeatureCard
                icon={<Globe className="h-6 w-6" />}
                title="Multi-Workspace"
                description="Manage multiple sites and brands from a single, unified command center."
              />
              <FeatureCard
                icon={<Target className="h-6 w-6" />}
                title="Precision Ops"
                description="Granular control over specific markets, intents, and content types."
              />
              <FeatureCard
                icon={<Sparkles className="h-6 w-6" />}
                title="AI Curator"
                description="Intelligent scoring filters out noise so you only see high-impact stones."
              />
              <FeatureCard
                icon={<BarChart3 className="h-6 w-6" />}
                title="Deduplication"
                description="Smart clustering prevents duplicate stories and tracks ongoing coverage."
              />
              <FeatureCard
                icon={<Workflow className="h-6 w-6" />}
                title="Smart Pipeline"
                description="Kanban-style workflow with human-in-the-loop approval gates."
              />
              <FeatureCard
                icon={<TrendingUp className="h-6 w-6" />}
                title="Deep Analytics"
                description="Track volume, engagement, and publishing velocity across all sites."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative border-t border-border/40 py-24 overflow-hidden">
          <div className="absolute inset-0 bg-primary/5" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-full bg-gradient-to-b from-primary/10 to-transparent blur-3xl pointer-events-none" />

          <div className="container mx-auto px-4 text-center relative z-10">
            <h2 className="mb-6 font-display text-4xl font-bold">
              Ready to automate your pipeline?
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Join the future of content operations. No credit card required.
            </p>
            <a href="/signup">
              <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 transition-transform hover:scale-105">
                <Globe className="mr-2 h-5 w-5" />
                Start Creating Magic
              </Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12 bg-card/20 backdrop-blur-lg">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2026 Content Santa. All rights reserved.</p>
          <p className="mt-2 text-xs">Designed by Antigravity</p>
        </div>
      </footer>
    </div>
  );
}

function WorkflowCard({ step, icon, title, description, delay }: {
  step: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      viewport={{ once: true }}
      className="group relative rounded-2xl border border-border/50 bg-card/40 p-8 backdrop-blur-sm transition-all hover:bg-card/60 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"
    >
      <div className="absolute -top-4 -left-4 h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-600 text-primary-foreground flex items-center justify-center font-bold shadow-lg shadow-primary/20">
        {step}
      </div>
      <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="mb-3 font-display text-xl font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="rounded-2xl border border-border/40 bg-card/30 p-8 backdrop-blur-sm transition-all hover:bg-card/50 hover:border-primary/20"
    >
      <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/5 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 font-display text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </motion.div>
  );
}

function AuthenticatedApp() {
  const { user, logout, isLoggingOut } = useAuth();
  const location = useLocation();

  const sidebarStyle = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background selection:bg-primary/20">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden relative">

          {/* Glass Header */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/40 bg-background/60 backdrop-blur-xl px-6 z-20">
            <SidebarTrigger className="-ml-2 hover:bg-accent/50 transition-colors" data-testid="button-sidebar-toggle" />

            <div className="flex items-center gap-4">
              {/* Context Info or Breadcrumbs could go here */}
              <div className="hidden md:flex items-center text-sm text-muted-foreground bg-accent/30 px-3 py-1 rounded-full border border-border/50">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                System Operational
              </div>

              {user && (
                <div className="flex items-center gap-3 pl-4 border-l border-border/40">
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-sm font-medium leading-none">{user.firstName || "User"}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  {sanitizeImageUrl(user.profileImageUrl) ? (
                    <img
                      src={sanitizeImageUrl(user.profileImageUrl)}
                      alt={user.firstName || "User"}
                      className="h-9 w-9 rounded-full ring-2 ring-border/50"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold ring-2 ring-border/50">
                      {user.firstName?.[0] || "U"}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => logout()}
                    disabled={isLoggingOut}
                    title="Sign out"
                  >
                    {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="i-lucide-log-out" />}
                  </Button>
                </div>
              )}
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-gradient-to-br from-background to-accent/5 p-6 relative">
            {/* Page Transitions - Minimal animation to prevent blank screens */}
            <AnimatePresence mode="wait">
              <motion.div
                key={location[0]}
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
                transition={{ duration: 0 }}
                className="h-full w-full"
              >
                <Router />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-muted-foreground animate-pulse text-sm">Loading Magic...</div>
        </div>
      </div>
    );
  }

  // Allow login and signup pages without authentication
  if (location === "/login") {
    return <Login />;
  }
  
  if (location === "/signup") {
    return <Signup />;
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="content-santa-theme">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
