# Content Santa - Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
- GitHub account with `contentsanta` repository
- Vercel account (free tier works)
- Supabase PostgreSQL database (already configured)
- OpenAI API key

---

## Step 1: Configure Vercel Project Settings

### Build & Output Settings
In Vercel dashboard, configure:

**Framework Preset:** `Vite`

**Root Directory:** `./` (keep as root)

**Build Command:**
```bash
npm run build
```

**Output Directory:**
```
dist/public
```

**Install Command:**
```bash
npm install
```

---

## Step 2: Environment Variables

Click "Environment Variables" section and add these **REQUIRED** variables:

### Database
```
DATABASE_URL=your_supabase_database_url_here
```
> **Get from:** Supabase → Project Settings → Database → Connection Pooling (Transaction mode, Port 6543)

### OpenAI API Keys
```
OPENAI_API_KEY=your_openai_api_key_here

AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key_here

AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```
> **Get from:** [OpenAI Platform](https://platform.openai.com/api-keys)

### Session & Security
```
SESSION_SECRET=your_random_session_secret_here

NODE_ENV=production

REPL_ID=vercel-production
```

### Port (Optional - Vercel auto-assigns)
```
PORT=5000
```

**Important:** 
- Make sure all variables are set for **Production**, **Preview**, and **Development** environments
- Do NOT commit `.env` file to GitHub (it's already in `.gitignore`)

---

## Step 3: Deploy

Click the **"Deploy"** button in Vercel.

Vercel will:
1. Clone your GitHub repo
2. Install dependencies
3. Run `npm run build`
4. Deploy frontend to CDN
5. Deploy API functions

---

## Step 4: Post-Deployment Configuration

### Update WordPress Plugin
After successful deployment, update the WordPress plugin with your new Vercel URL:

1. Go to your WordPress admin panel
2. Navigate to **Content Santa Connector** settings
3. Update **Server URL** to: `https://your-vercel-app.vercel.app`
4. Update **Callback URL** to: `https://your-vercel-app.vercel.app/api/wp/report`
5. Test the connection

### Update ngrok (Development Only)
For local development, continue using ngrok. For production, use Vercel URL directly.

---

## 🔧 Build Configuration Details

### What `npm run build` Does

From `package.json`:
```json
"build": "tsx script/build.ts"
```

This script:
1. Builds the Vite React frontend → `dist/public/`
2. Bundles the Express server → `dist/index.cjs`
3. Handles TypeScript compilation
4. Optimizes for production

### File Structure After Build
```
dist/
├── public/           # Vite-built frontend (static files)
│   ├── index.html
│   ├── assets/
│   └── ...
└── index.cjs        # Express server bundle
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Build Fails - TypeScript Errors
**Solution:** Run locally first:
```bash
npm run check
npm run build
```
Fix any TypeScript errors before deploying.

### Issue 2: Database Connection Fails
**Symptoms:** 500 errors, "connection refused"

**Solution:**
- Verify `DATABASE_URL` is correct (use **Transaction Pooler** URL from Supabase)
- Check Supabase allows connections from Vercel IPs
- Format: `postgresql://user:password@host:6543/database`

### Issue 3: Environment Variables Not Working
**Symptoms:** 401 errors, "OpenAI API key missing"

**Solution:**
1. Go to Vercel → Project Settings → Environment Variables
2. Verify all variables are set for all environments
3. Redeploy (changes to env vars require redeployment)

### Issue 4: API Routes Return 404
**Symptoms:** Frontend loads, but `/api/*` routes fail

**Solution:**
- Check `vercel.json` routes configuration
- Verify `dist/index.cjs` exists after build
- Check Vercel function logs for errors

### Issue 5: Session/Auth Not Working
**Symptoms:** Login fails, sessions don't persist

**Solution:**
- Verify `SESSION_SECRET` is set
- Check cookies are allowed (HTTPS required for production)
- Update session store to use PostgreSQL (not in-memory):

In `server/index.ts`, ensure you're using `connect-pg-simple`:
```typescript
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions'
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));
```

---

## 📊 Monitoring & Logs

### View Deployment Logs
1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments"
4. Click on the deployment → "View Function Logs"

### Real-Time Logs
```bash
vercel logs --follow
```

---

## 🔄 Continuous Deployment

Vercel automatically redeploys when you push to GitHub:

```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

Vercel will:
- Detect the push
- Trigger automatic build
- Deploy if build succeeds
- Update your production URL

---

## 🎯 Performance Optimization

### Enable Caching
In `vercel.json`, add:
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Database Connection Pooling
Already configured with Supabase Transaction Pooler (port 6543).

---

## 🔐 Security Checklist

- ✅ `.env` in `.gitignore` (never commit secrets)
- ✅ Environment variables set in Vercel dashboard (not in code)
- ✅ `SESSION_SECRET` is strong random string
- ✅ Database uses connection pooling
- ✅ HTTPS enforced (Vercel automatic)
- ✅ CORS configured properly for your domain

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Production Build](https://vitejs.dev/guide/build.html)
- [Express on Vercel](https://vercel.com/guides/using-express-with-vercel)
- [Supabase Pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)

---

## 🆘 Need Help?

If deployment fails:
1. Check Vercel build logs
2. Verify all environment variables
3. Test build locally: `npm run build && npm start`
4. Check GitHub repo is up to date

---

**Next Step:** Click "Deploy" in Vercel! 🚀
