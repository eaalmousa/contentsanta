import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { sanitizeImageUrl } from "@/lib/image-utils";
import { Send, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Comment, User } from "@shared/schema";

const commentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
});

type CommentFormValues = z.infer<typeof commentSchema>;

type CommentWithUser = Comment & {
  user?: User | null;
};

function CommentItem({ 
  comment, 
  currentUserId,
  onDelete 
}: { 
  comment: CommentWithUser; 
  currentUserId?: string;
  onDelete: () => void;
}) {
  const isOwner = currentUserId === comment.userId;
  const initials = comment.user?.firstName && comment.user?.lastName 
    ? `${comment.user.firstName[0]}${comment.user.lastName[0]}`
    : comment.userId.slice(0, 2).toUpperCase();

  return (
    <div className="group flex gap-3" data-testid={`comment-${comment.id}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={sanitizeImageUrl(comment.user?.profileImageUrl)} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" data-testid={`text-comment-author-${comment.id}`}>
            {comment.user?.firstName && comment.user?.lastName
              ? `${comment.user.firstName} ${comment.user.lastName}`
              : comment.user?.email || "Team Member"}
          </span>
          <span className="text-xs text-muted-foreground">
            {comment.createdAt
              ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
              : ""}
          </span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap" data-testid={`text-comment-body-${comment.id}`}>
          {comment.body}
        </p>
      </div>
      {isOwner && (
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 shrink-0"
          onClick={onDelete}
          data-testid={`button-delete-comment-${comment.id}`}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

interface CommentsPanelProps {
  assetVersionId: string;
  className?: string;
}

export function CommentsPanel({ assetVersionId, className }: CommentsPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      body: "",
    },
  });

  const { data: comments, isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/asset-versions", assetVersionId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/asset-versions/${assetVersionId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: !!assetVersionId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CommentFormValues) => {
      await apiRequest("POST", `/api/asset-versions/${assetVersionId}/comments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-versions", assetVersionId, "comments"] });
      form.reset();
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-versions", assetVersionId, "comments"] });
      toast({ title: "Comment deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    },
  });

  const handleSubmit = (data: CommentFormValues) => {
    setIsSubmitting(true);
    createMutation.mutate(data);
  };

  return (
    <div className={`flex flex-col gap-4 ${className || ""}`}>
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">Comments</h3>
        {comments && comments.length > 0 && (
          <span className="text-sm text-muted-foreground">({comments.length})</span>
        )}
      </div>

      {/* Comment input */}
      {user && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex gap-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={sanitizeImageUrl(user.profileImageUrl)} />
              <AvatarFallback className="text-xs">
                {user.firstName && user.lastName
                  ? `${user.firstName[0]}${user.lastName[0]}`
                  : "ME"}
              </AvatarFallback>
            </Avatar>
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Textarea
                      placeholder="Add a comment..."
                      className="min-h-[60px] resize-none"
                      {...field}
                      data-testid="input-comment"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSubmitting || !form.watch("body")}
              data-testid="button-submit-comment"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </Form>
      )}

      {/* Comments list */}
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <>
            <CommentSkeleton />
            <CommentSkeleton />
          </>
        ) : comments && comments.length > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onDelete={() => deleteMutation.mutate(comment.id)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No comments yet. Start the conversation!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
