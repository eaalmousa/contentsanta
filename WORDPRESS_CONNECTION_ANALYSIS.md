# WordPress Site Connection Analysis (Replit Model)

## 🔄 Dual Authentication System

From the screenshot, the Replit implementation uses **TWO separate credentials**:

### 1. **WordPress Application Password** (For Content Santa → WordPress)
**Purpose:** Allows Content Santa to READ from WordPress
- **Use Case:** Pull categories, tags, and existing content
- **Direction:** Content Santa → WordPress (outbound)
- **Endpoints Used:**
  - `GET /wp-json/wp/v2/categories`
  - `GET /wp-json/wp/v2/tags`
  - `GET /wp-json/wp/v2/posts`
- **Authentication:** WordPress REST API with Application Password
- **Permissions:** Read-only access to taxonomy and posts

### 2. **Secret Key** (For WordPress → Content Santa)
**Purpose:** Allows WordPress plugin to WRITE to Content Santa
- **Use Case:** Plugin pulls publishing jobs from Content Santa
- **Direction:** WordPress → Content Santa (inbound)
- **Authentication:** Custom secret key in plugin settings
- **Endpoints Used:**
  - `GET /api/wp/pull?siteId=xxx` (WordPress pulls jobs)
  - `POST /api/wp/report` (WordPress reports results)

---

## 📋 Site Configuration Fields

From the screenshot, each site stores:

```typescript
{
  // Site Identity
  siteId: "cs_site_gulf_gazette",           // Unique identifier
  siteName: "Gulf Estate Gazette",          // Display name
  
  // WordPress Connection (Outbound - CS → WP)
  wpUrl: "https://gulfestategazette.com",   // WordPress site URL
  wpAppPassword: "****xqzE",                 // Application password for REST API
  
  // Plugin Connection (Inbound - WP → CS)
  secretKey: "****xqzE",                     // Plugin authentication secret
  
  // Publishing Settings
  publishingMode: "Plugin Pull Only",        // vs "Direct REST" or "Both"
  
  // Connection Status
  status: "Active" | "Healthy",              // Connection health
  lastCheck: "less than a minute ago"        // Last health check
}
```

---

## 🔐 Authentication Flow Details

### Outbound: Content Santa → WordPress (REST API)

**Purpose:** Sync categories, tags, validate connection

```typescript
// WordPress REST API call with Application Password
const wpAuth = Buffer.from(`username:${appPassword}`).toString('base64');

const response = await fetch(`${wpUrl}/wp-json/wp/v2/categories`, {
  headers: {
    'Authorization': `Basic ${wpAuth}`,
    'Content-Type': 'application/json'
  }
});
```

**Endpoints:**
1. **Health Check:** `GET /wp-json/` - Verify site is reachable
2. **Categories Sync:** `GET /wp-json/wp/v2/categories` - Pull all categories
3. **Tags Sync:** `GET /wp-json/wp/v2/tags` - Pull all tags
4. **Test Connection:** Validate credentials work

**Required WP User Permissions:**
- Subscriber/Author role minimum
- Read access to categories and tags
- NO publishing permissions needed (read-only)

---

### Inbound: WordPress → Content Santa (Plugin Pull)

**Purpose:** Plugin fetches publishing jobs

```php
// WordPress plugin makes authenticated request
$response = wp_remote_get(
  $baseUrl . '/api/wp/pull?siteId=' . $siteId,
  [
    'headers' => [
      'X-ContentSanta-Secret' => $secretKey,
      'Content-Type' => 'application/json'
    ]
  ]
);
```

**Content Santa verifies:**
1. Secret key matches site record
2. Site is active
3. Returns next queued job or 204 (no jobs)

---

## 🎯 Why Two Separate Credentials?

| Direction | Credential | Purpose | Security Benefit |
|-----------|-----------|---------|------------------|
| CS → WP | WordPress App Password | Read categories/tags | WP controls what CS can read |
| WP → CS | Secret Key | Authenticate plugin | CS controls which plugins can pull |

**Benefits:**
1. ✅ **Principle of Least Privilege:** Each direction has minimal required permissions
2. ✅ **Revocation:** Can disable either direction independently
3. ✅ **Audit Trail:** Know which direction traffic is flowing
4. ✅ **Different Rotation Schedules:** Can rotate secrets independently

---

## 🔧 Implementation in Your Codebase

### 1. Sites Table Schema (Needs Update)

```typescript
// shared/schema.ts - Add these columns to sites table
export const sites = pgTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  workspaceId: text("workspace_id").notNull(),
  
  // WordPress REST API (outbound)
  wpUrl: text("wp_url"),                    // e.g., "https://site.com"
  wpUsername: text("wp_username"),          // WordPress username
  wpAppPassword: text("wp_app_password"),   // Application password
  
  // Plugin Pull (inbound)
  wpPullSecret: text("wp_pull_secret"),     // Secret for plugin auth
  
  // Publishing config
  publishingMode: text("publishing_mode")   // "plugin" | "rest" | "both"
    .notNull()
    .default("plugin"),
  
  // Connection health
  status: text("status").notNull().default("not_connected"),
  lastHealthCheck: timestamp("last_health_check"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
```

### 2. API Endpoints Needed

#### Outbound (CS → WordPress)

```typescript
// GET /api/sites/:id/sync/categories - Sync categories from WP
// GET /api/sites/:id/sync/tags - Sync tags from WP
// POST /api/sites/:id/test-connection - Health check
```

#### Inbound (WordPress → CS)

```typescript
// GET /api/wp/pull?siteId=xxx - Plugin pulls next job
// POST /api/wp/report - Plugin reports job result
```

### 3. WordPress Service

```typescript
// server/services/wordpress-service.ts
export class WordPressService {
  
  async testConnection(site: Site): Promise<boolean> {
    const auth = this.getBasicAuth(site.wpUsername, site.wpAppPassword);
    const response = await fetch(`${site.wpUrl}/wp-json/`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.ok;
  }
  
  async syncCategories(site: Site): Promise<Category[]> {
    const auth = this.getBasicAuth(site.wpUsername, site.wpAppPassword);
    const response = await fetch(`${site.wpUrl}/wp-json/wp/v2/categories?per_page=100`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.json();
  }
  
  async syncTags(site: Site): Promise<Tag[]> {
    const auth = this.getBasicAuth(site.wpUsername, site.wpAppPassword);
    const response = await fetch(`${site.wpUrl}/wp-json/wp/v2/tags?per_page=100`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return response.json();
  }
  
  private getBasicAuth(username: string, password: string): string {
    return Buffer.from(`${username}:${password}`).toString('base64');
  }
}
```

---

## 🚀 Setup Flow (From Screenshot)

### Step 1: Install Plugin on WordPress
```bash
1. Download "Content Santa Connector" plugin
2. Upload to WordPress: Plugins → Add New → Upload
3. Activate plugin
```

### Step 2: Configure in Content Santa
```typescript
1. Go to Publishing → Sites
2. Click "Connect Website"
3. Enter:
   - Site Name: "Gulf Estate Gazette"
   - WordPress URL: "https://gulfestategazette.com"
   - Publishing Mode: "Plugin Pull Only"
   - (Generate Site ID automatically)
   - (Generate Secret Key automatically)
```

### Step 3: Configure Plugin in WordPress
```bash
1. Go to WordPress Admin → Settings → Content Santa Connector
2. Enter:
   - Base URL: "https://santa-helper-eahnoussi.replit.app"
   - Site ID: "cs_site_gulf_gazette" (from CS)
   - Secret Key: "****xqzE" (from CS)
   - Poll Interval: 2 minutes
3. Click "Save" then "Test Connection"
```

### Step 4: Add WordPress Credentials (For Category Sync)
```typescript
1. Create Application Password in WordPress:
   - Go to Users → Profile
   - Scroll to "Application Passwords"
   - Name: "Content Santa"
   - Click "Add New Application Password"
   - Copy the generated password
   
2. Back in Content Santa:
   - Click "Edit" on your site
   - Add "Outbound Credentials" section
   - WordPress Username: (your WP admin username)
   - Application Password: (paste from step 1)
   - Click "Sync Categories & Tags"
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Content Santa                           │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Publishing  │────────▶│  wp_pull_    │                 │
│  │  Pipeline    │         │  jobs        │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                   │                          │
│                                   │ Job Queue               │
│                                   │                          │
│  ┌──────────────┐         ┌──────▼───────┐                 │
│  │  WordPress   │◀────────│  GET /api/   │                 │
│  │  Categories  │  Sync   │  wp/pull     │                 │
│  │  & Tags      │         └──────────────┘                 │
│  └──────┬───────┘                 ▲                         │
│         │                         │                         │
└─────────┼─────────────────────────┼─────────────────────────┘
          │                         │
          │ REST API                │ Secret Key Auth
          │ (App Password)          │
          ▼                         │
┌─────────────────────────────────────────────────────────────┐
│                    WordPress Site                            │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Categories  │────────▶│  Content     │                 │
│  │  Tags        │  Read   │  Santa       │                 │
│  │  (REST API)  │         │  Connector   │                 │
│  └──────────────┘         │  Plugin      │                 │
│                           │              │                 │
│                           │  • Polls CS  │                 │
│                           │  • Publishes │                 │
│                           │  • Reports   │                 │
│                           └──────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Benefits of This Dual-Auth Architecture

1. **Security:**
   - WordPress App Password is read-only
   - Secret key is write-only (for job pulling)
   - No credentials stored in WordPress (only secret)

2. **Flexibility:**
   - Can sync categories without plugin active
   - Can disable plugin without losing category sync
   - Can use REST API for urgent publishes

3. **Reliability:**
   - Plugin pull is self-healing (polls regularly)
   - REST API sync keeps taxonomy up-to-date
   - Independent failure domains

4. **Auditability:**
   - Know which direction each operation came from
   - Separate logs for inbound vs outbound
   - Easy to debug connection issues

---

## 🔧 Missing Pieces in Your Current Implementation

1. ❌ **No WP App Password storage** in sites table
2. ❌ **No category/tag sync endpoints**
3. ❌ **No WordPress REST API service**
4. ❌ **No health check implementation**

Would you like me to implement these missing pieces?
