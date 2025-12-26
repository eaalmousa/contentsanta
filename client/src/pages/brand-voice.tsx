import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Palette,
  Plus,
  Trash2,
  Save,
  Loader2,
  Building2,
  Users,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Brand } from "@shared/schema";

const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  industry: z.string().optional(),
  audience: z.string().optional(),
  tone: z.string().optional(),
  defaultLanguage: z.string().default("en"),
  styleRules: z.string().optional(),
});

type BrandFormValues = z.infer<typeof brandSchema>;

function TermsList({
  title,
  description,
  terms,
  onAdd,
  onRemove,
  variant = "approved",
}: {
  title: string;
  description: string;
  terms: string[];
  onAdd: (term: string) => void;
  onRemove: (term: string) => void;
  variant?: "approved" | "forbidden";
}) {
  const [newTerm, setNewTerm] = useState("");

  const handleAdd = () => {
    if (newTerm.trim()) {
      onAdd(newTerm.trim());
      setNewTerm("");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add a term..."
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          data-testid={`input-${variant}-term`}
        />
        <Button size="icon" onClick={handleAdd} data-testid={`button-add-${variant}-term`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No terms added yet</p>
        ) : (
          terms.map((term) => (
            <Badge
              key={term}
              variant={variant === "approved" ? "secondary" : "destructive"}
              className="gap-1 pr-1"
            >
              {term}
              <button
                onClick={() => onRemove(term)}
                className="ml-1 rounded-full p-0.5 hover:bg-black/10"
                data-testid={`button-remove-${variant}-term-${term}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

function BrandForm({
  brand,
  onSave,
  isPending,
}: {
  brand?: Brand;
  onSave: (data: BrandFormValues & { approvedTerms: string[]; forbiddenWords: string[] }) => void;
  isPending: boolean;
}) {
  const [approvedTerms, setApprovedTerms] = useState<string[]>(brand?.approvedTerms || []);
  const [forbiddenWords, setForbiddenWords] = useState<string[]>(brand?.forbiddenWords || []);

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: brand?.name || "",
      industry: brand?.industry || "",
      audience: brand?.audience || "",
      tone: brand?.tone || "",
      defaultLanguage: brand?.defaultLanguage || "en",
      styleRules: brand?.styleRules || "",
    },
  });

  const handleSubmit = (data: BrandFormValues) => {
    onSave({ ...data, approvedTerms, forbiddenWords });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-8">
        {/* Brand Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Building2 className="h-5 w-5" />
              Brand Identity
            </CardTitle>
            <CardDescription>
              Basic information about your brand
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your brand name" {...field} data-testid="input-brand-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Technology, Healthcare" {...field} data-testid="input-industry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="defaultLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-brand-language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Voice & Tone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <MessageSquare className="h-5 w-5" />
              Voice & Tone
            </CardTitle>
            <CardDescription>
              Define how your brand communicates
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="audience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your target audience..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="textarea-audience"
                    />
                  </FormControl>
                  <FormDescription>
                    Who is your content primarily written for?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Tone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tone">
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                      <SelectItem value="playful">Playful</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The overall tone for your content
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="styleRules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Style Rules</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your style guidelines...
- Always use Oxford comma
- Avoid passive voice
- Keep sentences short and clear"
                      className="min-h-[120px]"
                      {...field}
                      data-testid="textarea-style-rules"
                    />
                  </FormControl>
                  <FormDescription>
                    Specific writing rules the AI should follow
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Terminology */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-lg">
              <Users className="h-5 w-5" />
              Terminology
            </CardTitle>
            <CardDescription>
              Manage approved and forbidden terms
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            <TermsList
              title="Approved Terms"
              description="Terms that should be used consistently"
              terms={approvedTerms}
              onAdd={(term) => setApprovedTerms([...approvedTerms, term])}
              onRemove={(term) => setApprovedTerms(approvedTerms.filter((t) => t !== term))}
              variant="approved"
            />

            <TermsList
              title="Forbidden Words"
              description="Terms that should never be used"
              terms={forbiddenWords}
              onAdd={(term) => setForbiddenWords([...forbiddenWords, term])}
              onRemove={(term) => setForbiddenWords(forbiddenWords.filter((t) => t !== term))}
              variant="forbidden"
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button type="submit" size="lg" disabled={isPending} data-testid="button-save-brand">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-5 w-5" />
              Save Brand Settings
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function BrandVoice() {
  const { toast } = useToast();

  const { data: brands, isLoading } = useQuery<Brand[]>({
    queryKey: ["/api/brands"],
  });

  const currentBrand = brands?.[0];

  const saveMutation = useMutation({
    mutationFn: async (data: BrandFormValues & { approvedTerms: string[]; forbiddenWords: string[] }) => {
      if (currentBrand) {
        const res = await apiRequest("PATCH", `/api/brands/${currentBrand.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/brands", {
          ...data,
          workspaceId: "default",
        });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      toast({
        title: "Brand saved",
        description: "Your brand settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save brand settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-bold" data-testid="text-brand-title">
          Brand Voice
        </h1>
        <p className="text-muted-foreground">
          Configure your brand identity and voice settings for consistent AI-generated content.
        </p>
      </div>

      {/* Brand Form */}
      <div className="mx-auto w-full max-w-3xl">
        {isLoading ? (
          <div className="flex flex-col gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-60" />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <BrandForm
            brand={currentBrand}
            onSave={(data) => saveMutation.mutate(data)}
            isPending={saveMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
