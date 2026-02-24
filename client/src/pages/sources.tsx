import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Search, Check, X, Loader2, Globe, Tag, MapPin, Shield, Info, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SourceSuggestion {
  name: string;
  feedUrl: string;
  domain: string;
  description: string;
  language: string;
  region: string;
  country: string;
  tier: number;
  isOfficial: boolean;
  tags: string[];
}

interface Source {
  id: string;
  name: string;
  feedUrl: string;
  domain: string;
  description: string;
  language: string;
  region: string;
  country: string;
  tier: number;
  isOfficial: string;
  approvalStatus: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  tags?: string[];
  createdAt: string;
}

const REGIONS = [
  { value: "gcc", label: "GCC Countries" },
  { value: "mena", label: "Middle East & North Africa" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia Pacific" },
  { value: "north-america", label: "North America" },
  { value: "south-america", label: "South America" },
  { value: "africa", label: "Africa" },
  { value: "oceania", label: "Oceania" },
  { value: "global", label: "Global" },
];

const COUNTRIES = [
  // GCC
  { value: "AE", label: "United Arab Emirates", region: "gcc" },
  { value: "SA", label: "Saudi Arabia", region: "gcc" },
  { value: "KW", label: "Kuwait", region: "gcc" },
  { value: "QA", label: "Qatar", region: "gcc" },
  { value: "BH", label: "Bahrain", region: "gcc" },
  { value: "OM", label: "Oman", region: "gcc" },
  
  // MENA
  { value: "EG", label: "Egypt", region: "mena" },
  { value: "JO", label: "Jordan", region: "mena" },
  { value: "LB", label: "Lebanon", region: "mena" },
  { value: "IQ", label: "Iraq", region: "mena" },
  { value: "SY", label: "Syria", region: "mena" },
  { value: "YE", label: "Yemen", region: "mena" },
  { value: "PS", label: "Palestine", region: "mena" },
  { value: "IL", label: "Israel", region: "mena" },
  { value: "TR", label: "Turkey", region: "mena" },
  { value: "IR", label: "Iran", region: "mena" },
  { value: "MA", label: "Morocco", region: "mena" },
  { value: "DZ", label: "Algeria", region: "mena" },
  { value: "TN", label: "Tunisia", region: "mena" },
  { value: "LY", label: "Libya", region: "mena" },
  { value: "SD", label: "Sudan", region: "mena" },
  
  // Europe
  { value: "GB", label: "United Kingdom", region: "europe" },
  { value: "FR", label: "France", region: "europe" },
  { value: "DE", label: "Germany", region: "europe" },
  { value: "IT", label: "Italy", region: "europe" },
  { value: "ES", label: "Spain", region: "europe" },
  { value: "PT", label: "Portugal", region: "europe" },
  { value: "NL", label: "Netherlands", region: "europe" },
  { value: "BE", label: "Belgium", region: "europe" },
  { value: "CH", label: "Switzerland", region: "europe" },
  { value: "AT", label: "Austria", region: "europe" },
  { value: "SE", label: "Sweden", region: "europe" },
  { value: "NO", label: "Norway", region: "europe" },
  { value: "DK", label: "Denmark", region: "europe" },
  { value: "FI", label: "Finland", region: "europe" },
  { value: "PL", label: "Poland", region: "europe" },
  { value: "CZ", label: "Czech Republic", region: "europe" },
  { value: "GR", label: "Greece", region: "europe" },
  { value: "RU", label: "Russia", region: "europe" },
  { value: "UA", label: "Ukraine", region: "europe" },
  { value: "IE", label: "Ireland", region: "europe" },
  
  // Asia Pacific
  { value: "CN", label: "China", region: "asia" },
  { value: "JP", label: "Japan", region: "asia" },
  { value: "KR", label: "South Korea", region: "asia" },
  { value: "IN", label: "India", region: "asia" },
  { value: "PK", label: "Pakistan", region: "asia" },
  { value: "BD", label: "Bangladesh", region: "asia" },
  { value: "ID", label: "Indonesia", region: "asia" },
  { value: "MY", label: "Malaysia", region: "asia" },
  { value: "SG", label: "Singapore", region: "asia" },
  { value: "TH", label: "Thailand", region: "asia" },
  { value: "VN", label: "Vietnam", region: "asia" },
  { value: "PH", label: "Philippines", region: "asia" },
  { value: "MM", label: "Myanmar", region: "asia" },
  { value: "KH", label: "Cambodia", region: "asia" },
  { value: "LA", label: "Laos", region: "asia" },
  { value: "NP", label: "Nepal", region: "asia" },
  { value: "LK", label: "Sri Lanka", region: "asia" },
  { value: "AF", label: "Afghanistan", region: "asia" },
  { value: "MN", label: "Mongolia", region: "asia" },
  { value: "KZ", label: "Kazakhstan", region: "asia" },
  { value: "UZ", label: "Uzbekistan", region: "asia" },
  
  // North America
  { value: "US", label: "United States", region: "north-america" },
  { value: "CA", label: "Canada", region: "north-america" },
  { value: "MX", label: "Mexico", region: "north-america" },
  
  // South America
  { value: "BR", label: "Brazil", region: "south-america" },
  { value: "AR", label: "Argentina", region: "south-america" },
  { value: "CL", label: "Chile", region: "south-america" },
  { value: "CO", label: "Colombia", region: "south-america" },
  { value: "PE", label: "Peru", region: "south-america" },
  { value: "VE", label: "Venezuela", region: "south-america" },
  { value: "EC", label: "Ecuador", region: "south-america" },
  { value: "UY", label: "Uruguay", region: "south-america" },
  
  // Africa
  { value: "ZA", label: "South Africa", region: "africa" },
  { value: "NG", label: "Nigeria", region: "africa" },
  { value: "KE", label: "Kenya", region: "africa" },
  { value: "ET", label: "Ethiopia", region: "africa" },
  { value: "GH", label: "Ghana", region: "africa" },
  { value: "TZ", label: "Tanzania", region: "africa" },
  { value: "UG", label: "Uganda", region: "africa" },
  { value: "SN", label: "Senegal", region: "africa" },
  { value: "CI", label: "Côte d'Ivoire", region: "africa" },
  { value: "CM", label: "Cameroon", region: "africa" },
  
  // Oceania
  { value: "AU", label: "Australia", region: "oceania" },
  { value: "NZ", label: "New Zealand", region: "oceania" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "it", label: "Italian" },
  { value: "tr", label: "Turkish" },
  { value: "nl", label: "Dutch" },
  { value: "sv", label: "Swedish" },
  { value: "pl", label: "Polish" },
  { value: "id", label: "Indonesian" },
  { value: "th", label: "Thai" },
  { value: "vi", label: "Vietnamese" },
  { value: "fa", label: "Persian" },
  { value: "he", label: "Hebrew" },
  { value: "uk", label: "Ukrainian" },
  { value: "el", label: "Greek" },
  { value: "cs", label: "Czech" },
  { value: "ro", label: "Romanian" },
  { value: "hu", label: "Hungarian" },
  { value: "da", label: "Danish" },
  { value: "fi", label: "Finnish" },
  { value: "no", label: "Norwegian" },
  { value: "bn", label: "Bengali" },
  { value: "ur", label: "Urdu" },
  { value: "ms", label: "Malay" },
  { value: "sw", label: "Swahili" },
];

const TOPIC_SUGGESTIONS = [
  "Business & Finance",
  "Real Estate & Property",
  "Politics & Government",
  "Technology & Innovation",
  "Economy & Markets",
  "Energy & Oil",
  "Tourism & Hospitality",
  "Healthcare & Medicine",
  "Education",
  "Sports",
  "Entertainment & Culture",
  "Environment & Climate",
  "Science & Research",
  "Legal & Justice",
  "Defense & Security",
];

export default function SourcesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("discover");
  
  // Discovery form state
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("en");
  
  // Combobox open states
  const [countryOpen, setCountryOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  
  // Suggestions from AI
  const [suggestions, setSuggestions] = useState<SourceSuggestion[]>([]);
  
  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingSource, setRejectingSource] = useState<Source | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Search and filter state for source lists
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");

  // Filter countries by selected region
  const filteredCountries = useMemo(() => {
    if (!region || region === "global") {
      return COUNTRIES;
    }
    return COUNTRIES.filter(c => c.region === region);
  }, [region]);

  // Reset country when region changes
  const handleRegionChange = (value: string) => {
    setRegion(value);
    // Reset country if it's not in the new region
    if (country && value !== "global") {
      const countryInRegion = COUNTRIES.find(c => c.value === country && c.region === value);
      if (!countryInRegion) {
        setCountry("");
      }
    }
  };

  // Filter function for source lists
  const filterSources = (sources: Source[]) => {
    return sources.filter((source) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Language filter
      const matchesLanguage = filterLanguage === "all" || source.language === filterLanguage;

      // Region filter
      const matchesRegion = filterRegion === "all" || source.region === filterRegion;

      // Tier filter
      const matchesTier = filterTier === "all" || source.tier.toString() === filterTier;

      return matchesSearch && matchesLanguage && matchesRegion && matchesTier;
    });
  };

  // Fetch all sources
  const { data: allSources = [], isLoading: loadingSources } = useQuery<Source[]>({
    queryKey: ["/api/admin/sources"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/sources");
      return await res.json();
    },
  });

  const pendingSources = filterSources(allSources.filter(s => s.approvalStatus === "pending"));
  const approvedSources = filterSources(allSources.filter(s => s.approvalStatus === "approved"));
  const rejectedSources = filterSources(allSources.filter(s => s.approvalStatus === "rejected"));
  const filteredAllSources = filterSources(allSources);

  // AI Discovery mutation
  const discoverMutation = useMutation({
    mutationFn: async (params: { region?: string; country?: string; topic?: string; language?: string }) => {
      const res = await apiRequest("POST", "/api/admin/sources/discover", params);
      return await res.json();
    },
    onSuccess: (data: SourceSuggestion[]) => {
      setSuggestions(data);
      toast({
        title: "Sources discovered!",
        description: `Found ${data.length} sources matching your criteria.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Discovery failed",
        description: error.message || "Failed to discover sources",
        variant: "destructive",
      });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/admin/sources/${sourceId}/approve`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
      toast({
        title: "Source approved",
        description: "Source is now available to all users.",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ sourceId, reason }: { sourceId: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/sources/${sourceId}/reject`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
      setRejectDialogOpen(false);
      setRejectingSource(null);
      setRejectionReason("");
      toast({
        title: "Source rejected",
        description: "Source has been rejected.",
      });
    },
  });

  // Add suggestion to database for review
  const addSuggestionMutation = useMutation({
    mutationFn: async (suggestion: SourceSuggestion) => {
      const res = await apiRequest("POST", "/api/admin/sources/add-suggestion", suggestion);
      return await res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
      
      // Remove the added suggestion from the suggestions list
      setSuggestions((prev) => prev.filter((s) => s.feedUrl !== variables.feedUrl));
      
      toast({
        title: "Source added for review",
        description: "Source has been added to pending list. You can now approve or reject it.",
      });
      // Switch to pending tab to see the source
      setActiveTab("pending");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add source",
        description: error.message || "This source may already exist.",
        variant: "destructive",
      });
    },
  });

  const handleDiscover = () => {
    if (!region && !country && !topic && !language) {
      toast({
        title: "Search criteria required",
        description: "Please provide at least one search criterion (region, country, topic, or language).",
        variant: "destructive",
      });
      return;
    }

    discoverMutation.mutate({
      region: region || undefined,
      country: country || undefined,
      topic: topic || undefined,
      language: language || undefined,
    });
  };

  const handleReject = (source: Source) => {
    setRejectingSource(source);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!rejectingSource) return;
    rejectMutation.mutate({
      sourceId: rejectingSource.id,
      reason: rejectionReason || "Rejected by admin",
    });
  };

  // Render filter controls for list tabs
  const renderFilterControls = () => (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search name, domain, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="filter-language">Language</Label>
            <Select value={filterLanguage} onValueChange={setFilterLanguage}>
              <SelectTrigger id="filter-language">
                <SelectValue placeholder="All languages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-region">Region</Label>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger id="filter-region">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {REGIONS.map((reg) => (
                  <SelectItem key={reg.value} value={reg.value}>
                    {reg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-tier">Tier</Label>
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger id="filter-tier">
                <SelectValue placeholder="All tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="1">Tier 1 - Official</SelectItem>
                <SelectItem value="2">Tier 2 - Major</SelectItem>
                <SelectItem value="3">Tier 3 - Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(searchQuery || filterLanguage !== "all" || filterRegion !== "all" || filterTier !== "all") && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Active filters applied
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setFilterLanguage("all");
                setFilterRegion("all");
                setFilterTier("all");
              }}
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const getTierBadge = (tier: number) => {
    switch (tier) {
      case 1:
        return <Badge className="bg-purple-500">Tier 1 - Official</Badge>;
      case 2:
        return <Badge className="bg-blue-500">Tier 2 - Major</Badge>;
      case 3:
        return <Badge className="bg-green-500">Tier 3 - Quality</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500"><Loader2 className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500"><X className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderSourceCard = (source: Source | SourceSuggestion, isExisting: boolean = true) => {
    const existingSource = isExisting ? source as Source : null;
    const suggestion = !isExisting ? source as SourceSuggestion : null;

    return (
      <Card key={existingSource?.id || suggestion?.feedUrl} className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {(suggestion?.isOfficial || existingSource?.isOfficial === "true") && (
                  <Shield className="h-4 w-4 text-purple-500" />
                )}
                {source.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {source.description}
              </CardDescription>
            </div>
            {existingSource && (
              <div className="ml-4">
                {getStatusBadge(existingSource.approvalStatus)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {getTierBadge(source.tier)}
            <Badge variant="outline">
              <Globe className="h-3 w-3 mr-1" />
              {source.language.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              <MapPin className="h-3 w-3 mr-1" />
              {source.region} / {source.country}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Domain:</span>{" "}
              <code className="text-xs bg-muted px-2 py-1 rounded">{source.domain}</code>
            </div>
            <div>
              <span className="font-medium">Feed URL:</span>{" "}
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">{source.feedUrl}</code>
            </div>
          </div>

          {source.tags && source.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {source.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {existingSource?.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <strong>Rejection reason:</strong> {existingSource.rejectionReason}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {/* For AI suggestions not yet in database */}
            {!isExisting && suggestion && (
              <Button
                size="sm"
                onClick={() => addSuggestionMutation.mutate(suggestion)}
                disabled={addSuggestionMutation.isPending}
                className="w-full"
              >
                {addSuggestionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Add for Review
                  </>
                )}
              </Button>
            )}
            
            {/* For existing sources in database */}
            {existingSource?.approvalStatus === "pending" && (
              <>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(existingSource.id)}
                  disabled={approveMutation.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(existingSource)}
                  disabled={rejectMutation.isPending}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {existingSource?.approvalStatus === "approved" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(existingSource)}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
            )}
            {existingSource?.approvalStatus === "rejected" && (
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(existingSource.id)}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Re-approve
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Source Management</h1>
          <p className="text-muted-foreground mt-1">
            Discover and approve high-quality news sources with AI
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Shield className="h-4 w-4 mr-2" />
          Site Admin
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="discover">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Discovery
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({allSources.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingSources.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedSources.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({rejectedSources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-6">
          {/* Usage Instructions */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm text-blue-900">
                  <p className="font-semibold">How to use AI Source Discovery:</p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Select at least one criterion: Region, Country, Topic, or Language</li>
                    <li><strong>Region first:</strong> Choose a region to filter countries by geography</li>
                    <li><strong>Country & Language:</strong> Use search to quickly find what you need</li>
                    <li><strong>Custom Topics:</strong> Type any topic you're interested in (e.g., "Cryptocurrency", "Aviation")</li>
                    <li>Mix criteria for better results (e.g., "France + Technology + French")</li>
                    <li>AI will find high-quality RSS feeds matching your criteria, excluding already discovered sources</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI-Powered Source Discovery
              </CardTitle>
              <CardDescription>
                Discover high-quality RSS news feeds from around the world using AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Region (Optional)</Label>
                  <Select value={region} onValueChange={handleRegionChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Country (Optional - Searchable)</Label>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryOpen}
                        className="w-full justify-between"
                      >
                        {country
                          ? COUNTRIES.find((c) => c.value === country)?.label
                          : "Search country..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search country..." />
                        <CommandList>
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup>
                            {filteredCountries.map((c) => (
                              <CommandItem
                                key={c.value}
                                value={c.value}
                                onSelect={(currentValue) => {
                                  setCountry(currentValue === country ? "" : currentValue);
                                  setCountryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    country === c.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {c.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {region && region !== "global" && (
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredCountries.length} countries in {REGIONS.find(r => r.value === region)?.label}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Topic (Optional - Type your own)</Label>
                  <Input
                    type="text"
                    placeholder="e.g., Real Estate, Technology, Sports..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    list="topic-suggestions"
                  />
                  <datalist id="topic-suggestions">
                    {TOPIC_SUGGESTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">
                    Type any topic or choose from suggestions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Language (Optional - Searchable)</Label>
                  <Popover open={languageOpen} onOpenChange={setLanguageOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={languageOpen}
                        className="w-full justify-between"
                      >
                        {language
                          ? LANGUAGES.find((l) => l.value === language)?.label
                          : "Search language..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search language..." />
                        <CommandList>
                          <CommandEmpty>No language found.</CommandEmpty>
                          <CommandGroup>
                            {LANGUAGES.map((l) => (
                              <CommandItem
                                key={l.value}
                                value={l.value}
                                onSelect={(currentValue) => {
                                  setLanguage(currentValue === language ? "" : currentValue);
                                  setLanguageOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    language === l.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {l.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button
                onClick={handleDiscover}
                disabled={discoverMutation.isPending}
                className="w-full"
                size="lg"
              >
                {discoverMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Discovering sources...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Discover Sources
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {suggestions.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">
                AI Suggestions ({suggestions.length})
              </h2>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4 pr-4">
                  {suggestions.map((suggestion) => renderSourceCard(suggestion, false))}
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          {renderFilterControls()}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {loadingSources ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredAllSources.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {allSources.length === 0 
                      ? "No sources found. Use AI Discovery to find sources."
                      : "No sources match your filters. Try adjusting your search criteria."}
                  </CardContent>
                </Card>
              ) : (
                filteredAllSources.map((source) => renderSourceCard(source))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pending">
          {renderFilterControls()}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {pendingSources.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {allSources.filter(s => s.approvalStatus === "pending").length === 0
                      ? "No pending sources."
                      : "No pending sources match your filters."}
                  </CardContent>
                </Card>
              ) : (
                pendingSources.map((source) => renderSourceCard(source))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="approved">
          {renderFilterControls()}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {approvedSources.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {allSources.filter(s => s.approvalStatus === "approved").length === 0
                      ? "No approved sources yet."
                      : "No approved sources match your filters."}
                  </CardContent>
                </Card>
              ) : (
                approvedSources.map((source) => renderSourceCard(source))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="rejected">
          {renderFilterControls()}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {rejectedSources.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    {allSources.filter(s => s.approvalStatus === "rejected").length === 0
                      ? "No rejected sources."
                      : "No rejected sources match your filters."}
                  </CardContent>
                </Card>
              ) : (
                rejectedSources.map((source) => renderSourceCard(source))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Source</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this source.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <div className="text-sm font-medium">{rejectingSource?.name}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Source is not reliable, feed is broken, not relevant..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Reject Source
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
