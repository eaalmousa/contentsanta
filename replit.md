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
- **Build**: esbuild for production bundling with selective dependency bundling

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Validation**: Zod schemas generated from Drizzle schemas via `drizzle-zod`
- **Migrations**: Drizzle Kit with migrations in `./migrations` directory

### Core Data Models
- **Workspaces**: Multi-tenant container for brands and content
- **Brands**: Voice profiles with tone, audience, approved terms, forbidden words
- **Inputs**: Raw content (URLs, text, PDFs, transcripts, briefs)
- **Workflow Runs**: AI processing jobs with status tracking
- **Assets**: Generated content outputs with approval workflow
- **Projects**: Content organization containers

### AI Workflow System
- Workflow types defined in schema: headline_pack, blog_draft, social_pack, seo_optimize, translation_ar_en, translation_en_ar, rewrite_tone, expand, summarize, image_prompts, repurpose_transcript
- Each workflow has metadata (label, description, icon, output type)
- Processing simulated server-side with 1.5s async delay, then creates assets
- Status updates: pending → running → completed/failed

### Storage Layer
- **Current**: In-memory storage (MemStorage) for MVP development
- Assets, inputs, workflow runs, brands, workspaces stored in Maps
- Ready for database migration when needed

### Recent Changes (December 2025)
- Fixed Content Library not rendering assets: Added staleTime: 0 and refetchOnMount: "always" to assets query
- Fixed workflow processing try-catch block structure
- Added logging to processWorkflow for debugging

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components (shadcn/ui)
    pages/        # Route pages
    hooks/        # Custom React hooks
    lib/          # Utilities and query client
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Data access layer
  vite.ts         # Vite dev middleware
shared/           # Shared code between client/server
  schema.ts       # Drizzle schema + Zod types
```

### Development vs Production
- **Development**: Vite dev server with HMR proxied through Express
- **Production**: Static files served from `dist/public`, server bundle in `dist/index.cjs`

## External Dependencies

### Database
- **PostgreSQL**: Primary database via Neon (cloud PostgreSQL)
- **Connection**: `DATABASE_URL` environment variable required
- **Session Storage**: `connect-pg-simple` for Express sessions

### UI Component Libraries
- **Radix UI**: Full suite of accessible primitives (dialog, dropdown, tabs, etc.)
- **Embla Carousel**: Carousel/slider functionality
- **cmdk**: Command palette component
- **Vaul**: Drawer component
- **react-day-picker**: Calendar/date picker

### Build and Development
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner for Replit environment
- **PostCSS**: Tailwind CSS processing with autoprefixer

### Potential Future Integrations (from product spec)
- OpenAI for AI workflow processing
- Cloudflare R2/S3 for file storage (PDFs, documents)
- OAuth providers (Google) for authentication
- Publishing channel integrations