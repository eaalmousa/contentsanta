import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Site {
  id: string;
  workspaceId: string;
  name: string;
  url: string | null;
  connectionStatus: "not_connected" | "connected" | "error";
  lastConnectedAt: string | null;
  wpSiteUrl: string | null;
  wpUsername: string | null;
  wpAppPassword: string | null;
  wpPullSecret: string | null;
  wpDefaultCategory: string | null;
  wpDefaultStatus: string | null;
  publishingMode: string | null;
  lastCategorySync: string | null;
  lastTagSync: string | null;
  categoriesCount: number;
  tagsCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WpCategory {
  id: string;
  siteId: string;
  wpCategoryId: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  count: number;
  syncedAt: string;
}

interface WpTag {
  id: string;
  siteId: string;
  wpTagId: number;
  name: string;
  slug: string;
  description: string | null;
  count: number;
  syncedAt: string;
}

export default function SitesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  // Fetch sites
  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  // Fetch categories for selected site
  const { data: categories } = useQuery<WpCategory[]>({
    queryKey: [`/api/sites/${selectedSite?.id}/categories`],
    enabled: !!selectedSite?.id,
  });

  // Fetch tags for selected site
  const { data: tags } = useQuery<WpTag[]>({
    queryKey: [`/api/sites/${selectedSite?.id}/tags`],
    enabled: !!selectedSite?.id,
  });

  // Create site mutation
  const createSiteMutation = useMutation({
    mutationFn: async (data: Partial<Site>) => {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Site created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create site", description: error.message, variant: "destructive" });
    },
  });

  // Update site mutation
  const updateSiteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Site> }) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setEditingSite(null);
      toast({ title: "Site updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update site", description: error.message, variant: "destructive" });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const response = await fetch(`/api/sites/${siteId}/test-connection`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      if (data.ok) {
        toast({ 
          title: "Connection successful", 
          description: `Connected to ${data.siteInfo?.name}` 
        });
      } else {
        toast({ 
          title: "Connection failed", 
          description: data.error, 
          variant: "destructive" 
        });
      }
    },
  });

  // Sync categories mutation
  const syncCategoriesMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const response = await fetch(`/api/sites/${siteId}/sync/categories`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sites/${selectedSite?.id}/categories`] });
      toast({ 
        title: "Categories synced", 
        description: data.message 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Sync failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Sync tags mutation
  const syncTagsMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const response = await fetch(`/api/sites/${siteId}/sync/tags`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: [`/api/sites/${selectedSite?.id}/tags`] });
      toast({ 
        title: "Tags synced", 
        description: data.message 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Sync failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">WordPress Sites</h1>
          <p className="text-muted-foreground">
            Manage your WordPress site connections and publishing settings
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add WordPress Site</DialogTitle>
              <DialogDescription>
                Connect a new WordPress site for content publishing
              </DialogDescription>
            </DialogHeader>
            <SiteForm
              onSubmit={(data) => createSiteMutation.mutate(data)}
              isLoading={createSiteMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sites?.map((site) => (
          <Card key={site.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    {site.name}
                    {site.connectionStatus === "connected" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {site.connectionStatus === "error" && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    {site.wpSiteUrl && (
                      <a
                        href={site.wpSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        {new URL(site.wpSiteUrl).hostname}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSite(site)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Publishing Mode</span>
                  <Badge variant="secondary">
                    {site.publishingMode || "Plugin"}
                  </Badge>
                </div>
                
                {site.wpUsername && site.wpAppPassword && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Categories</span>
                      <span>
                        {site.categoriesCount || 0}
                        {site.lastCategorySync && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (synced {new Date(site.lastCategorySync).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tags</span>
                      <span>
                        {site.tagsCount || 0}
                        {site.lastTagSync && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (synced {new Date(site.lastTagSync).toLocaleDateString()})
                          </span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-2">
                {site.wpUsername && site.wpAppPassword && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnectionMutation.mutate(site.id)}
                      disabled={testConnectionMutation.isPending}
                    >
                      {testConnectionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSite(site);
                      }}
                    >
                      View Details
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Site Dialog */}
      <Dialog open={!!editingSite} onOpenChange={() => setEditingSite(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update WordPress site configuration
            </DialogDescription>
          </DialogHeader>
          {editingSite && (
            <SiteForm
              site={editingSite}
              onSubmit={(data) =>
                updateSiteMutation.mutate({ id: editingSite.id, data })
              }
              isLoading={updateSiteMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Site Details Dialog */}
      <Dialog open={!!selectedSite} onOpenChange={() => setSelectedSite(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSite?.name}</DialogTitle>
            <DialogDescription>{selectedSite?.wpSiteUrl}</DialogDescription>
          </DialogHeader>
          
          {selectedSite && (
            <Tabs defaultValue="categories">
              <TabsList>
                <TabsTrigger value="categories">
                  Categories ({selectedSite.categoriesCount || 0})
                </TabsTrigger>
                <TabsTrigger value="tags">
                  Tags ({selectedSite.tagsCount || 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="categories" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {selectedSite.lastCategorySync
                      ? `Last synced: ${new Date(selectedSite.lastCategorySync).toLocaleString()}`
                      : "Not synced yet"}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => syncCategoriesMutation.mutate(selectedSite.id)}
                    disabled={syncCategoriesMutation.isPending}
                  >
                    {syncCategoriesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </div>
                
                <div className="grid gap-2">
                  {categories?.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{cat.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {cat.slug} • {cat.count} posts
                        </div>
                      </div>
                      <Badge variant="outline">ID: {cat.wpCategoryId}</Badge>
                    </div>
                  ))}
                  {!categories?.length && (
                    <p className="text-center text-muted-foreground py-8">
                      No categories synced yet. Click "Sync Now" to fetch from WordPress.
                    </p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="tags" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    {selectedSite.lastTagSync
                      ? `Last synced: ${new Date(selectedSite.lastTagSync).toLocaleString()}`
                      : "Not synced yet"}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => syncTagsMutation.mutate(selectedSite.id)}
                    disabled={syncTagsMutation.isPending}
                  >
                    {syncTagsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                </div>
                
                <div className="grid gap-2">
                  {tags?.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{tag.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {tag.slug} • {tag.count} posts
                        </div>
                      </div>
                      <Badge variant="outline">ID: {tag.wpTagId}</Badge>
                    </div>
                  ))}
                  {!tags?.length && (
                    <p className="text-center text-muted-foreground py-8">
                      No tags synced yet. Click "Sync Now" to fetch from WordPress.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Site Form Component
function SiteForm({
  site,
  onSubmit,
  isLoading,
}: {
  site?: Site;
  onSubmit: (data: Partial<Site>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: site?.name || "",
    wpSiteUrl: site?.wpSiteUrl || "",
    wpUsername: site?.wpUsername || "",
    wpAppPassword: site?.wpAppPassword || "",
    publishingMode: site?.publishingMode || "plugin",
    wpDefaultStatus: site?.wpDefaultStatus || "draft",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Site Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="My WordPress Site"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wpSiteUrl">WordPress URL</Label>
        <Input
          id="wpSiteUrl"
          type="url"
          value={formData.wpSiteUrl}
          onChange={(e) => setFormData({ ...formData, wpSiteUrl: e.target.value })}
          placeholder="https://yoursite.com"
          required
        />
        <p className="text-xs text-muted-foreground">
          The full URL of your WordPress site
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wpUsername">WordPress Username</Label>
        <Input
          id="wpUsername"
          value={formData.wpUsername}
          onChange={(e) => setFormData({ ...formData, wpUsername: e.target.value })}
          placeholder="admin"
        />
        <p className="text-xs text-muted-foreground">
          Your WordPress admin username for REST API access
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wpAppPassword">Application Password</Label>
        <Input
          id="wpAppPassword"
          type="password"
          value={formData.wpAppPassword}
          onChange={(e) => setFormData({ ...formData, wpAppPassword: e.target.value })}
          placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
        />
        <p className="text-xs text-muted-foreground">
          Create this in WordPress: Users → Profile → Application Passwords
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="publishingMode">Publishing Mode</Label>
        <Select
          value={formData.publishingMode}
          onValueChange={(value) => setFormData({ ...formData, publishingMode: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plugin">Plugin Pull Only</SelectItem>
            <SelectItem value="rest">REST API Direct</SelectItem>
            <SelectItem value="both">Both (Plugin + REST)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wpDefaultStatus">Default Post Status</Label>
        <Select
          value={formData.wpDefaultStatus}
          onValueChange={(value) => setFormData({ ...formData, wpDefaultStatus: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="publish">Publish</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Site"
          )}
        </Button>
      </div>
    </form>
  );
}
