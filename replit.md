# Content Santa

## Overview

Content Santa is an AI-powered content platform designed for agencies, marketing teams, and content creators. The platform ingests raw content (URLs, text, PDFs, transcripts, briefs), processes it through specialized AI workflows (rewrite, expand, translate, SEO optimization, social variants), and produces ready-to-publish assets. It maintains a searchable content library with brand voice management, templates, and approval workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Forms**: React Hook Form with Zod validation
- **Fonts**: Inter (body text) and Space Grotesk (headings) via Google Fonts

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Style**: RESTful JSON API under `/api` prefix
- **Authentication**: Replit Auth with OpenID Connect
- **Build**: esbuild for production bundling with selective dependency bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (Neon-backed via Replit)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Drizzle Kit with `npm run db:push` for schema sync

### Core Data Models (13 tables)
- **users**: Authenticated users from Replit Auth
- **sessions**: Session management for authentication
- **workspaces**: Multi-tenant containers for brands and content
- **workspace_users**: Role-based permissions (owner, admin, editor, reviewer, viewer)
- **brands**: Voice profiles with tone, audience, approved terms, forbidden words
- **inputs**: Raw content (URLs, text, PDFs, transcripts, briefs)
- **workflow_runs**: AI processing jobs with status tracking
- **assets**: Generated content containers with approval workflow
- **asset_versions**: Full version history for each asset
- **templates**: Reusable content templates
- **comments**: Collaboration comments on assets
- **publishing_targets**: Integration targets for publishing
- **publish_jobs**: Publish job history
- **usage_ledger**: Usage tracking for billing

### AI Workflow System
- **Provider**: OpenAI via Replit AI Integrations (no API key required, billed to credits)
- **Model**: gpt-4o-mini for content generation
- **Workflow types**: headline_pack, seo_blog, social_pack, press_release, newsletter, rewrite_tone, executive_brief, expand_longform, summarize, translation_ar_en, translation_en_ar, image_prompts, repurpose_transcript
- **Processing**: Async workflow with real AI generation
- **Status flow**: queued → running → succeeded/failed/cancelled

### Authentication
- **Provider**: Replit Auth with OpenID Connect
- **Supported logins**: Google, GitHub, X, Apple, email/password
- **Session management**: PostgreSQL-backed sessions via connect-pg-simple
- **Protected routes**: All mutation endpoints require authentication

### Asset Versioning
- **Design**: Assets are containers; asset_versions hold actual content
- **Fields on version**: title, body, workflowType, language, channel, versionNo
- **History**: Full version history maintained for each asset
- **API**: GET /api/assets returns assets with latestVersion included

### Visual Intelligence System
- **Image Assets**: `image_assets` table stores images linked to stories and source items
- **Image Origins**: "source" (extracted from RSS) or "generated" (AI-created placeholder)
- **RSS Extraction**: Extracts from media:thumbnail, media:content, enclosure (image/* types)
- **Deduplication**: Images are deduplicated per story by URL
- **Primary Selection**: Auto-selects best image based on source tier (tier_1 > tier_2 > tier_3)
- **Premium Entitlement**: `workspace.features.generate_images` flag gates AI image generation

### WordPress Publishing
- **Secure Image Download**: HTTPS-only, SSRF protection (blocks private IPs), MIME validation
- **Media Upload**: Uploads to WordPress Media Library with caption/credit
- **Featured Image**: Sets `featured_media` on posts automatically
- **Image Usages**: Tracks where images are published via `image_usages` table

### Automation Pipeline v1.0 (January 2026)
The automation pipeline transforms Content Santa from manual workflow to automation-first:

**Pipeline Items (12-state machine)**:
- Status flow: fetched → matched → deduped → ranked → generated → gated → scheduled → publishing → published → verified
- Failure states: retrying, quarantined, skipped
- Each item tracks a story through a specific topic/pipeline

**Automation Job Runs**:
- Job types: fetch, match, generate, gate, schedule, publish, verify
- Tracks execution statistics (processed, success, fail, skip, quarantine counts)
- Logs stored per job run

**Topics Enhanced (Pipeline Mode)**:
- `automationMode`: manual | semi | auto
- `sourceMode`: all | selected | keywords
- Keyword filtering: includeKeywords, excludeKeywords
- Policy flags: requireHumanGate, requireEnglish, allowDuplicates
- Rate limiting: dailyCap, minSpacingMinutes, quietHours
- Publishing counters: publishedToday, publishedTodayDate

**Publishing Targets Enhanced**:
- Health check fields: isActive, lastHealthCheckAt, lastHealthStatus, lastHealthMessage
- Default publishing settings (status, author, taxonomy rules)

**Schema Tables Added**:
- `pipeline_items`: 12-state tracking with FK to topics, stories, workspaces, publishing_targets
- `automation_job_runs`: Job execution logging with FK to topics, workspaces
- `publish_attempts`: Detailed publish attempt logging with FK to pipeline_items, publishing_targets

### Recent Changes (December 2025)
- Migrated from in-memory storage to PostgreSQL with 13 tables
- Implemented Replit Auth with OpenID Connect
- Added role-based workspace permissions
- Implemented asset versioning system
- Integrated OpenAI via Replit AI Integrations for real AI processing
- Added templates, comments, and publishing targets support
- Updated frontend for authentication with landing page for visitors
- Added Visual Intelligence Phase 1: RSS image extraction with tier-based primary selection
- Implemented WordPress featured image upload with SSRF protection and MIME validation
- Added workspace feature flags for premium entitlements (generate_images)

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components (shadcn/ui)
    pages/        # Route pages
    hooks/        # Custom React hooks (including use-auth.ts)
    lib/          # Utilities and query client
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # DatabaseStorage implementation (50+ methods)
  db.ts           # Drizzle database connection
  ai-workflow.ts  # OpenAI-powered workflow processor
  replit_integrations/
    auth/         # Replit Auth integration
    batch/        # Batch processing utilities
    chat/         # Chat routes and storage
    image/        # Image generation
shared/           # Shared code between client/server
  schema.ts       # Drizzle schema + Zod types
  models/         # Additional model definitions
```

### Development Commands
- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database
- `npm run build` - Build for production

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `SESSION_SECRET` - Session encryption key
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (auto-configured)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (auto-configured)

## External Dependencies

### Database
- **PostgreSQL**: Primary database via Neon (cloud PostgreSQL)
- **Connection**: `DATABASE_URL` environment variable (auto-configured)
- **Session Storage**: `connect-pg-simple` for Express sessions

### AI Integration
- **OpenAI**: Via Replit AI Integrations (gpt-4o-mini, gpt-image-1)
- **Batch Processing**: p-limit and p-retry for rate limiting

### UI Component Libraries
- **Radix UI**: Full suite of accessible primitives
- **Embla Carousel**: Carousel/slider functionality
- **cmdk**: Command palette component
- **Vaul**: Drawer component
- **react-day-picker**: Calendar/date picker

### Build and Development
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner
- **PostCSS**: Tailwind CSS processing with autoprefixer
