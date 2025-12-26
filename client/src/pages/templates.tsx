import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
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
import type { Template } from "@shared/schema";
import { workflowMeta } from "@shared/schema";

const templateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  content: z.string().min(10, "Content must be at least 10 characters"),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

function TemplateCard({ template, onEdit }: { template: Template; onEdit: () => void }) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/templates/${template.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const workflowInfo = template.type && workflowMeta[template.type as keyof typeof workflowMeta];

  return (
    <Card data-testid={`card-template-${template.id}`}>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h3 className="font-medium truncate" data-testid={`text-template-name-${template.id}`}>
                  {template.name}
                </h3>
                {workflowInfo && (
                  <span className="text-xs text-muted-foreground">
                    {workflowInfo.label}
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-template-menu-${template.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate()}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="line-clamp-3 text-sm text-muted-foreground">
            {template.content.slice(0, 150)}
            {template.content.length > 150 ? "..." : ""}
          </p>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">{template.type}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-6 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTemplateDialog({ open, onOpenChange, editTemplate }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  editTemplate?: Template | null;
}) {
  const { toast } = useToast();
  const isEditing = !!editTemplate;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: editTemplate?.name || "",
      type: editTemplate?.type || "",
      content: editTemplate?.content || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      if (isEditing) {
        await apiRequest("PATCH", `/api/templates/${editTemplate.id}`, data);
      } else {
        await apiRequest("POST", "/api/templates", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: isEditing ? "Template updated" : "Template created" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to save template", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update your template details." : "Create a reusable content template."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Template" {...field} data-testid="input-template-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-template-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(workflowMeta).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Content</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter your template content with placeholders like {{title}}, {{content}}..."
                      className="min-h-32"
                      {...field} 
                      data-testid="input-template-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-template">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const handleEdit = (template: Template) => {
    setEditTemplate(template);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditTemplate(null);
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl font-bold" data-testid="text-templates-title">
            Templates
          </h1>
          <p className="text-muted-foreground">
            Create and manage reusable content templates.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-create-template">
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <TemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onEdit={() => handleEdit(template)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-16">
          <FileText className="h-16 w-16 text-muted-foreground/50" />
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="font-serif text-xl font-semibold">No templates yet</h3>
            <p className="max-w-sm text-muted-foreground">
              Create your first template to speed up content creation.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-create-first-template">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      )}

      <CreateTemplateDialog 
        open={dialogOpen} 
        onOpenChange={handleDialogChange}
        editTemplate={editTemplate}
      />
    </div>
  );
}
