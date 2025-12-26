import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText,
  Link as LinkIcon,
  Upload,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import type { InputType } from "@shared/schema";

const inputTypes: { value: InputType; label: string; icon: React.ElementType; description: string }[] = [
  { 
    value: "text", 
    label: "Plain Text", 
    icon: FileText,
    description: "Paste or type your content directly" 
  },
  { 
    value: "url", 
    label: "URL", 
    icon: LinkIcon,
    description: "Import content from a web page" 
  },
  { 
    value: "brief", 
    label: "Content Brief", 
    icon: FileText,
    description: "Structured brief with topic and details" 
  },
];

const textInputSchema = z.object({
  type: z.literal("text"),
  title: z.string().min(1, "Title is required"),
  rawText: z.string().min(10, "Content must be at least 10 characters"),
  language: z.string().default("en"),
});

const urlInputSchema = z.object({
  type: z.literal("url"),
  title: z.string().min(1, "Title is required"),
  sourceUrl: z.string().url("Please enter a valid URL"),
  language: z.string().default("en"),
});

const briefInputSchema = z.object({
  type: z.literal("brief"),
  title: z.string().min(1, "Title is required"),
  rawText: z.string().min(10, "Brief must be at least 10 characters"),
  language: z.string().default("en"),
});

type TextInputValues = z.infer<typeof textInputSchema>;
type UrlInputValues = z.infer<typeof urlInputSchema>;
type BriefInputValues = z.infer<typeof briefInputSchema>;

function TextInputForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<TextInputValues>({
    resolver: zodResolver(textInputSchema),
    defaultValues: {
      type: "text",
      title: "",
      rawText: "",
      language: "en",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TextInputValues) => {
      const res = await apiRequest("POST", "/api/inputs", {
        ...data,
        workspaceId: "default",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Content created",
        description: "Your content has been saved successfully.",
      });
      setLocation(`/workflows?inputId=${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create content. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter a title for your content" 
                  {...field} 
                  data-testid="input-content-title"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rawText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Paste or type your content here..."
                  className="min-h-[200px] resize-y"
                  {...field}
                  data-testid="textarea-content-body"
                />
              </FormControl>
              <FormDescription>
                Enter the raw content you want to transform with AI workflows.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Language</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-language">
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

        <Button type="submit" disabled={mutation.isPending} data-testid="button-create-submit">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

function UrlInputForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<UrlInputValues>({
    resolver: zodResolver(urlInputSchema),
    defaultValues: {
      type: "url",
      title: "",
      sourceUrl: "",
      language: "en",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: UrlInputValues) => {
      const res = await apiRequest("POST", "/api/inputs", {
        ...data,
        workspaceId: "default",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Content imported",
        description: "Content from URL has been imported successfully.",
      });
      setLocation(`/workflows?inputId=${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to import content. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter a title for this content" 
                  {...field}
                  data-testid="input-url-title" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sourceUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://example.com/article" 
                  type="url"
                  {...field}
                  data-testid="input-source-url" 
                />
              </FormControl>
              <FormDescription>
                Enter the URL of the page you want to import content from.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Language</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-url-language">
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

        <Button type="submit" disabled={mutation.isPending} data-testid="button-import-url">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Import & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

function BriefInputForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<BriefInputValues>({
    resolver: zodResolver(briefInputSchema),
    defaultValues: {
      type: "brief",
      title: "",
      rawText: "",
      language: "en",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: BriefInputValues) => {
      const res = await apiRequest("POST", "/api/inputs", {
        ...data,
        workspaceId: "default",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Brief created",
        description: "Your content brief has been saved successfully.",
      });
      setLocation(`/workflows?inputId=${data.id}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create brief. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Topic / Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="What's the main topic?" 
                  {...field}
                  data-testid="input-brief-title" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rawText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brief Details</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the content you need:
- Target audience
- Key points to cover
- Desired tone and style
- Any specific requirements..."
                  className="min-h-[200px] resize-y"
                  {...field}
                  data-testid="textarea-brief-details"
                />
              </FormControl>
              <FormDescription>
                Provide as much detail as possible for better AI results.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Output Language</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-brief-language">
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

        <Button type="submit" disabled={mutation.isPending} data-testid="button-create-brief">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

export default function CreateContent() {
  const [selectedType, setSelectedType] = useState<InputType | null>(null);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-bold" data-testid="text-create-title">
          Create Content
        </h1>
        <p className="text-muted-foreground">
          Add new content to transform with AI-powered workflows.
        </p>
      </div>

      {!selectedType ? (
        /* Input Type Selection */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inputTypes.map((type) => (
            <Card
              key={type.value}
              className="cursor-pointer transition-all hover-elevate"
              onClick={() => setSelectedType(type.value)}
              data-testid={`card-input-type-${type.value}`}
            >
              <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                  <type.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{type.label}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Input Form */
        <div className="mx-auto w-full max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(null)}
                  data-testid="button-back-to-types"
                >
                  Back
                </Button>
                <div>
                  <CardTitle className="font-serif">
                    {inputTypes.find((t) => t.value === selectedType)?.label}
                  </CardTitle>
                  <CardDescription>
                    {inputTypes.find((t) => t.value === selectedType)?.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedType === "text" && <TextInputForm onSuccess={() => {}} />}
              {selectedType === "url" && <UrlInputForm onSuccess={() => {}} />}
              {selectedType === "brief" && <BriefInputForm onSuccess={() => {}} />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
