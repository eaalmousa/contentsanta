import { useState } from "react";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Globe,
  CreditCard,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const settingsSections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "language", label: "Language & Region", icon: Globe },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "security", label: "Security", icon: Shield },
  { id: "help", label: "Help & Support", icon: HelpCircle },
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState("profile");

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl font-bold" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account and workspace preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <Card className="lg:col-span-1">
          <CardContent className="p-2">
            <nav className="flex flex-col gap-1">
              {settingsSections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-muted font-medium"
                        : "hover:bg-muted/50"
                    }`}
                    data-testid={`nav-settings-${section.id}`}
                  >
                    <section.icon className="h-5 w-5 text-muted-foreground" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Profile Settings</CardTitle>
                <CardDescription>
                  Manage your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center gap-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl font-medium">
                    CS
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" data-testid="button-change-avatar">
                      Change Avatar
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG or GIF. Max 2MB.
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="Demo User" data-testid="input-profile-name" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue="demo@contentsanta.io" data-testid="input-profile-email" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Input id="bio" placeholder="Tell us about yourself..." data-testid="input-profile-bio" />
                </div>

                <Button className="w-fit" data-testid="button-save-profile">
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Notification Preferences</CardTitle>
                <CardDescription>
                  Control how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Workflow Completion</Label>
                    <span className="text-sm text-muted-foreground">
                      Get notified when AI workflows complete
                    </span>
                  </div>
                  <Switch defaultChecked data-testid="switch-notify-workflow" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Content Approvals</Label>
                    <span className="text-sm text-muted-foreground">
                      Notifications for content needing approval
                    </span>
                  </div>
                  <Switch defaultChecked data-testid="switch-notify-approvals" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Weekly Digest</Label>
                    <span className="text-sm text-muted-foreground">
                      Summary of your weekly content activity
                    </span>
                  </div>
                  <Switch data-testid="switch-notify-digest" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Marketing Updates</Label>
                    <span className="text-sm text-muted-foreground">
                      Product updates and feature announcements
                    </span>
                  </div>
                  <Switch data-testid="switch-notify-marketing" />
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "language" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Language & Region</CardTitle>
                <CardDescription>
                  Set your preferred language and regional settings
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label>Interface Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger data-testid="select-interface-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Default Content Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger data-testid="select-content-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est">Eastern Time (EST)</SelectItem>
                      <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                      <SelectItem value="gmt">Gulf Standard Time (GST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "billing" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Billing & Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and payment methods
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Free Plan</span>
                      <Badge variant="secondary">Current</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      5 workflow runs per month
                    </span>
                  </div>
                  <Button variant="outline" data-testid="button-upgrade-plan">
                    Upgrade
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  <Label>Usage This Month</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Workflow Runs</span>
                      <span className="font-medium">3 / 5</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 w-3/5 rounded-full bg-primary" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Label>Payment Method</Label>
                  <p className="text-sm text-muted-foreground">
                    No payment method on file
                  </p>
                  <Button variant="outline" className="w-fit" data-testid="button-add-payment">
                    Add Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "security" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Security Settings</CardTitle>
                <CardDescription>
                  Protect your account and data
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <Label>Two-Factor Authentication</Label>
                    <span className="text-sm text-muted-foreground">
                      Add an extra layer of security
                    </span>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-enable-2fa">
                    Enable
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  <Label>Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Last changed 30 days ago
                  </p>
                  <Button variant="outline" className="w-fit" data-testid="button-change-password">
                    Change Password
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  <Label>Active Sessions</Label>
                  <p className="text-sm text-muted-foreground">
                    1 active session on this device
                  </p>
                  <Button variant="outline" className="w-fit" data-testid="button-manage-sessions">
                    Manage Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "help" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Help & Support</CardTitle>
                <CardDescription>
                  Get help with Content Santa
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Button variant="outline" className="justify-between" data-testid="button-documentation">
                  <span>Documentation</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="justify-between" data-testid="button-tutorials">
                  <span>Video Tutorials</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="justify-between" data-testid="button-contact-support">
                  <span>Contact Support</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="justify-between" data-testid="button-feedback">
                  <span>Send Feedback</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
