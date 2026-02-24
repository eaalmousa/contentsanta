# 🎅 Content Santa

**AI-Powered Content Automation Platform for WordPress**

Content Santa is an intelligent content aggregation and publishing system that automatically discovers RSS feeds, generates AI-enhanced articles, and publishes them to WordPress sites with a pull-based architecture.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## ✨ Features

### 🤖 Intelligent Content Generation
- **RSS Feed Discovery**: AI-powered discovery of high-quality RSS feeds based on topics, regions, and languages
- **Content Aggregation**: Automatic fetching and parsing of articles from multiple sources
- **AI Enhancement**: OpenAI-powered content rewriting and optimization
- **Featured Images**: Smart image resolution from source articles with AI generation fallback (DALL-E 3)

### 📰 Publishing Automation
- **WordPress Integration**: Pull-based publishing architecture with v0.8.3 plugin
- **Image Optimization**: Automatic image compression and resizing
- **Category Matching**: AI-powered taxonomy mapping to existing WordPress categories
- **Duplicate Prevention**: Content hash-based deduplication
- **Status Tracking**: Real-time pipeline with status updates

### 🎯 Content Management
- **Multi-Workspace**: Isolated workspaces for different publications
- **Topic Management**: Create topics with geographic and language filters
- **Source Approval**: Admin workflow for discovering and approving RSS sources
- **Publishing Targets**: Configure multiple WordPress sites per workspace
- **Analytics Dashboard**: Track pipeline performance and publishing metrics

### 🔒 Security & Control
- **RBAC**: Role-based access control (Owner, Admin, Editor, Viewer)
- **Content Filtering**: Geographic, language, and topic relevance filters
- **Quality Gates**: Pre-publish validation and sanitization
- **Custom Authentication**: Email + Google OAuth integration

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **PostgreSQL** database (Supabase recommended)
- **OpenAI API Key** for content generation and image creation
- **WordPress** site (for publishing)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/eaalmousa/contentsanta.git
cd contentsanta
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```bash
# Database (Supabase)
DATABASE_URL=postgresql://user:password@host:6543/postgres

# OpenAI API Keys
OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# Application
NODE_ENV=development
PORT=5000
SESSION_SECRET=your-random-secret-here
```

4. **Start the development server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

---

## 📦 Tech Stack

### Frontend
- **React** 18 with TypeScript
- **Vite** for fast builds
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **React Query** for data fetching

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Drizzle ORM** for database
- **PostgreSQL** database
- **Passport.js** for authentication

### AI & Content
- **OpenAI GPT-4** for content generation
- **DALL-E 3** for image generation
- **RSS Parser** for feed processing
- **Cheerio** for HTML parsing

### Background Workers
- **Automated Scheduling**: RSS fetch, content generation, publishing
- **Reaper Service**: Cleanup stale jobs
- **Publishing Worker**: Processes items every 3 minutes

---

## 🏗️ Architecture

### Content Pipeline

```
┌─────────────────┐
│  RSS Discovery  │  ← AI finds sources by topic/region
└────────┬────────┘
         │
┌────────▼────────┐
│   RSS Fetch     │  ← Pull articles every 30 min
└────────┬────────┘
         │
┌────────▼────────┐
│  Topic Match    │  ← Filter by relevance & geography
└────────┬────────┘
         │
┌────────▼────────┐
│    Generate     │  ← AI rewrites & enhances
└────────┬────────┘
         │
┌────────▼────────┐
│     Rank        │  ← Score by quality
└────────┬────────┘
         │
┌────────▼────────┐
│   Schedule      │  ← Queue for publishing
└────────┬────────┘
         │
┌────────▼────────┐
│   Publishing    │  ← Create WP pull jobs
└────────┬────────┘
         │
┌────────▼────────┐
│  WordPress      │  ← Plugin pulls & publishes
└─────────────────┘
```

### WordPress Integration

Content Santa uses a **pull-based** architecture:

1. Server creates publishing jobs in database
2. WordPress plugin polls for jobs (every 3 min)
3. Plugin creates posts with images
4. Plugin sends success callback to server
5. Server updates pipeline status

**Benefits:**
- ✅ No inbound firewall rules needed
- ✅ WordPress controls publishing timing
- ✅ Resilient to network issues
- ✅ Easy to debug and monitor

---

## 🔌 WordPress Plugin Setup

### Installation

1. **Download the plugin**
   - File: `content-santa-connector-v0.8.3.php`

2. **Upload to WordPress**
   ```
   WordPress Admin → Plugins → Add New → Upload Plugin
   ```

3. **Activate the plugin**

4. **Configure settings**
   - Base URL: Your Content Santa server URL
   - Site ID: Get from Content Santa admin panel
   - Secret Key: Get from publishing target settings

### Plugin Features
- ✅ Automatic job polling (every 3 minutes)
- ✅ Image optimization (max 2000px, 85% quality)
- ✅ Featured image handling
- ✅ Category and tag assignment
- ✅ Custom post status support
- ✅ Detailed logging for debugging

---

## 📖 Usage Guide

### 1. Create a Workspace
Every organization needs a workspace to isolate their content.

### 2. Connect WordPress Site
Configure a publishing target with your WordPress credentials.

### 3. Discover RSS Sources
Use the admin panel to search for RSS feeds:
- By topic (e.g., "Real Estate")
- By region (e.g., "Middle East")
- By language (e.g., "English")

Approve sources you want to monitor.

### 4. Create Topics
Define what content you want:
- Topic name (e.g., "Gulf Real Estate News")
- Keywords to track
- Geographic filters (countries/regions)
- Language preferences
- Publishing schedule

### 5. Monitor Pipeline
Watch articles move through the pipeline:
- **Items**: All discovered articles
- **Generating**: AI processing articles
- **Publishing**: Creating WordPress posts
- **Published**: Live on WordPress

### 6. Review Analytics
Track performance:
- Articles published per day
- Topic performance
- Success rates
- Pipeline health

---

## 🛠️ Development

### Project Structure

```
contentsanta/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   └── lib/              # Utilities
│   └── public/               # Static assets
│
├── server/                    # Express backend
│   ├── services/             # Business logic
│   │   ├── automation-service.ts
│   │   ├── publishing-worker-service.ts
│   │   ├── featured-image-service.ts
│   │   └── taxonomy-matcher.ts
│   ├── routes/               # API endpoints
│   ├── middleware/           # Auth & RBAC
│   └── index.ts              # Server entry
│
├── shared/                    # Shared types
│   └── schema.ts             # Database schema
│
├── scripts/                   # Development scripts
└── *.ts                      # Test utilities
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Building
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm run test             # Run tests (if configured)

# Database
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio
```

### API Endpoints

**Authentication**
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Email login
- `GET /api/auth/google` - Google OAuth
- `POST /api/auth/logout` - Logout

**Workspaces**
- `GET /api/me/context` - Get user workspaces
- `GET /api/workspaces/:id` - Get workspace details

**Topics**
- `GET /api/topics` - List topics
- `POST /api/topics` - Create topic
- `PATCH /api/topics/:id` - Update topic
- `DELETE /api/topics/:id` - Delete topic

**Sources**
- `GET /api/sources` - List RSS sources
- `POST /api/admin/sources/discover` - AI discovery
- `POST /api/admin/sources/approve` - Approve source

**Pipeline**
- `GET /api/pipeline/items` - List pipeline items
- `GET /api/analytics/pipeline` - Pipeline analytics

**WordPress**
- `GET /api/wp/pull` - Pull publishing jobs (plugin)
- `POST /api/wp/report` - Report job status (plugin)

---

## 🔐 Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:6543/db` |
| `OPENAI_API_KEY` | OpenAI API key for content | `sk-proj-...` |
| `SESSION_SECRET` | Secret for session encryption | Random 64-char string |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API base URL | `https://api.openai.com/v1` |

---

## 🧪 Testing

### Manual Testing Scripts

The project includes 150+ utility scripts for testing:

```bash
# Check database connection
npx tsx --env-file=.env check-db-connection.ts

# Verify pipeline status
npx tsx --env-file=.env check-pipeline-status.ts

# Monitor publishing
npx tsx --env-file=.env monitor-publishing-progress.ts

# Reset items for republishing
npx tsx --env-file=.env reset-google-logo-articles.ts
```

---

## 📊 Performance

### Background Workers

| Worker | Interval | Purpose |
|--------|----------|---------|
| RSS Fetch | 30 min | Pull articles from sources |
| Topic Discovery | 20 min | Find new RSS feeds |
| Pipeline Automation | 10 min | Move items through pipeline |
| **Publishing Worker** | **3 min** | Create WordPress jobs |
| Reaper | 5 min | Cleanup stale jobs |

### Scaling Considerations

- **Database**: Use connection pooling (Supabase recommended)
- **Workers**: Can be run in separate processes
- **Caching**: Redis for session storage (optional)
- **Rate Limiting**: OpenAI API limits considered

---

## 🐛 Troubleshooting

### Common Issues

**1. Publishing stuck in "Publishing" status**
- Check WordPress plugin is active
- Verify WordPress can reach server URL
- Check server logs for callback errors

**2. No articles appearing**
- Verify RSS sources are approved
- Check topic filters aren't too restrictive
- Review pipeline analytics for errors

**3. Images not showing**
- Check OpenAI API key for DALL-E access
- Verify WordPress can download images
- Check featured image service logs

**4. Authentication issues**
- Clear browser cookies
- Check session secret is set
- Verify database connection

### Debug Mode

Enable detailed logging:
```bash
NODE_ENV=development npm run dev
```

Check WordPress plugin logs:
```
wp-content/debug.log
```

---

## 📝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Write descriptive commit messages
- Add comments for complex logic

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 and DALL-E 3 APIs
- **Supabase** for PostgreSQL hosting
- **shadcn/ui** for beautiful components
- **Drizzle ORM** for type-safe database access

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/eaalmousa/contentsanta/issues)
- **Discussions**: [GitHub Discussions](https://github.com/eaalmousa/contentsanta/discussions)
- **Email**: eaalmousa@gmail.com

---

## 🗺️ Roadmap

### v1.1 (Coming Soon)
- [ ] Multiple publishing targets per topic
- [ ] Scheduled publishing slots
- [ ] Content calendar view
- [ ] Webhook notifications

### v1.2
- [ ] Multi-language content generation
- [ ] Custom AI models support
- [ ] Advanced analytics dashboard
- [ ] Content approval workflow

### v2.0
- [ ] Social media integration
- [ ] Email newsletter publishing
- [ ] Content performance tracking
- [ ] A/B testing for titles

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/eaalmousa">eaalmousa</a>
</p>

<p align="center">
  <a href="https://github.com/eaalmousa/contentsanta">⭐ Star this repo</a> if you find it useful!
</p>
