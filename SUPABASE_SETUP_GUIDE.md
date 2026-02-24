# Supabase Connection Setup Guide

## Option 1: Use Existing Supabase Project

If you already have a Supabase project:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Find the **Connection String** section
5. Copy the **Connection pooling** URI (with `?pgbouncer=true`)

### Update .env file:

```env
DATABASE_URL=postgresql://postgres.xxxxx:YOUR_PASSWORD@xxx.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## Option 2: Create New Supabase Project

### Step 1: Create Project
1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Name:** content-santa (or your choice)
   - **Database Password:** (save this!)
   - **Region:** Choose closest to you
4. Wait for project to be created (~2 minutes)

### Step 2: Get Connection String
1. Go to **Settings** → **Database**
2. Scroll to **Connection String**
3. Select **Connection pooling** (recommended for serverless)
4. Copy the URI
5. Replace `[YOUR-PASSWORD]` with your actual password

### Step 3: Update .env
```env
DATABASE_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@xxx.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## Connection String Format

### Supabase Connection Pooling (Recommended):
```
postgresql://postgres.[project-ref]:[password]@[project-ref].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Direct Connection (for migrations):
```
postgresql://postgres.[project-ref]:[password]@[project-ref].supabase.co:5432/postgres
```

---

## After Updating .env

1. **Stop current server** (if running)
2. **Restart server:**
   ```powershell
   npm run dev
   ```

3. **Database will auto-migrate** on first connection

---

## Troubleshooting

### Connection Failed?
- Check password has no special characters that need escaping
- Verify project is fully initialized (not still deploying)
- Try direct connection string instead of pooler

### SSL Errors?
Add to connection string:
```
?sslmode=require
```

---

## Benefits of Supabase

- ✅ **Free tier:** 500MB database, 2GB bandwidth
- ✅ **Auto-backups:** Daily backups included
- ✅ **Connection pooling:** Better for serverless
- ✅ **Built-in Auth:** Can use Supabase Auth later
- ✅ **Real-time:** Built-in real-time subscriptions
- ✅ **Dashboard:** Great UI for viewing data

---

## Need Help?

Provide your Supabase connection string (with password masked), and I'll help configure it.

Example:
```
DATABASE_URL=postgresql://postgres.abcxyz:YOUR_PASSWORD_HERE@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
