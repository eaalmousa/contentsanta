import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Users,
  MoreHorizontal,
  Mail,
  Shield,
  Trash2,
  Crown,
  Edit2,
  Loader2,
  UserCheck,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { WorkspaceUser, User, RoleType } from "@shared/schema";

type TeamMember = WorkspaceUser & {
  user?: User | null;
  email?: string;
  status?: string;
};

const roleOptions: { value: RoleType; label: string; description: string; icon: typeof Crown }[] = [
  { value: "owner", label: "Owner", description: "Full access, can delete workspace", icon: Crown },
  { value: "admin", label: "Admin", description: "Manage team and settings", icon: Shield },
  { value: "editor", label: "Editor", description: "Create and edit content", icon: Edit2 },
  { value: "reviewer", label: "Reviewer", description: "Review and approve content", icon: UserCheck },
  { value: "viewer", label: "Viewer", description: "View-only access", icon: Users },
];

const roleColors: Record<RoleType, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  editor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  reviewer: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["owner", "admin", "editor", "reviewer", "viewer"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

function MemberCard({ 
  member, 
  currentUserId,
  onChangeRole,
  onRemove 
}: { 
  member: TeamMember; 
  currentUserId?: string;
  onChangeRole: (role: RoleType) => void;
  onRemove: () => void;
}) {
  const isCurrentUser = currentUserId === member.userId;
  const isOwner = member.role === "owner";
  const isPending = member.status === "invited" || member.userId.startsWith("invite_");
  
  const displayName = member.user?.firstName && member.user?.lastName
    ? `${member.user.firstName} ${member.user.lastName}`
    : member.email || member.userId;
    
  const initials = member.user?.firstName && member.user?.lastName
    ? `${member.user.firstName[0]}${member.user.lastName[0]}`
    : displayName.slice(0, 2).toUpperCase();

  const roleInfo = roleOptions.find(r => r.value === member.role);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4" data-testid={`card-member-${member.id}`}>
      <div className="flex items-center gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.user?.profileImageUrl || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium" data-testid={`text-member-name-${member.id}`}>
              {displayName}
            </span>
            {isCurrentUser && (
              <Badge variant="outline">You</Badge>
            )}
            {isPending && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Pending
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {member.user?.email || member.email || ""}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className={roleColors[member.role]}>
          {roleInfo?.label || member.role}
        </Badge>
        
        {!isOwner && !isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-member-menu-${member.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                Change Role
              </DropdownMenuItem>
              {roleOptions.filter(r => r.value !== "owner").map((role) => (
                <DropdownMenuItem
                  key={role.value}
                  onClick={() => onChangeRole(role.value)}
                  className={member.role === role.value ? "bg-muted" : ""}
                >
                  <role.icon className="mr-2 h-4 w-4" />
                  {role.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function MemberSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

function InviteDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "editor",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      await apiRequest("POST", "/api/team/invite", {
        ...data,
        workspaceId: "default",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Invitation sent" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to send invitation", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to collaborate on this workspace.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => inviteMutation.mutate(data))} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        placeholder="colleague@company.com" 
                        className="pl-9"
                        {...field} 
                        data-testid="input-invite-email"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-invite-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.filter(r => r.value !== "owner").map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div className="flex flex-col gap-0.5">
                            <span>{role.label}</span>
                            <span className="text-xs text-muted-foreground">{role.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose what this person can do in the workspace.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Mail className="mr-2 h-4 w-4" />
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Team() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
    queryFn: async () => {
      const res = await fetch("/api/team?workspaceId=default");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleType }) => {
      await apiRequest("PATCH", `/api/team/${id}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Role updated" });
    },
    onError: () => {
      toast({ title: "Failed to update role", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ workspaceId, userId }: { workspaceId: string; userId: string }) => {
      await apiRequest("DELETE", `/api/team/${workspaceId}/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Member removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove member", variant: "destructive" });
    },
  });

  const sortedMembers = members?.sort((a, b) => {
    const roleOrder: Record<RoleType, number> = { owner: 0, admin: 1, editor: 2, reviewer: 3, viewer: 4 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-4xl font-bold" data-testid="text-team-title">
            Team
          </h1>
          <p className="text-muted-foreground">
            Manage team members and their access permissions.
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-member">
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Role Guide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Role Permissions</CardTitle>
          <CardDescription>Understanding what each role can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {roleOptions.map((role) => (
              <div key={role.value} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <role.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{role.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{role.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members?.length || 0} member{(members?.length || 0) !== 1 ? "s" : ""} in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <MemberSkeleton key={i} />
              ))}
            </div>
          ) : sortedMembers && sortedMembers.length > 0 ? (
            <div className="flex flex-col gap-3">
              {sortedMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  currentUserId={user?.id}
                  onChangeRole={(role) => updateRoleMutation.mutate({ id: member.id, role })}
                  onRemove={() => removeMutation.mutate({ workspaceId: member.workspaceId, userId: member.userId })}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <div className="flex flex-col items-center gap-2 text-center">
                <h3 className="font-semibold">No team members yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Invite colleagues to collaborate on content creation and review.
                </p>
              </div>
              <Button onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-first">
                <Plus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <InviteDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />
    </div>
  );
}
