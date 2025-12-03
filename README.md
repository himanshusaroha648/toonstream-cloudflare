# Toonstream Supabase Sync

Toonstream scraper + Supabase uploader - Works on both **Node.js** and **Cloudflare Workers**

## Features

- Toonstream website se anime episodes scrape karta hai
- TMDB se metadata fetch karta hai (poster, rating, description)
- Supabase database mein store karta hai
- Har 1 minute pe automatic sync
- Proxy support (optional)

---

## Option 1: Cloudflare Workers pe Deploy

### Step 1: Wrangler Install karo

```bash
npm install -g wrangler
```

### Step 2: Cloudflare Login

```bash
wrangler login
```

### Step 3: Project Setup

```bash
cd toonstream-cloudflare
npm install
```

### Step 4: SECRETS ADD KARO (IMPORTANT!)

```bash
wrangler secret put SUPABASE_URL
# Prompt aayega, apna Supabase URL paste karo

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Prompt aayega, apna service role key paste karo

wrangler secret put TMDB_API_KEY
# Prompt aayega, apna TMDB API key paste karo
```

### Step 5: Deploy

```bash
npm run deploy
```

Ya:

```bash
wrangler deploy
```

### Cloudflare Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Health check |
| `/sync` | Manual sync trigger |
| `/status` | Service status |

### Cron Schedule

Worker **har 1 minute** pe automatic sync karega. Change karna ho to `wrangler.toml` mein:

```toml
[triggers]
crons = ["*/5 * * * *"]  # Har 5 minute
```

---

## Option 2: Node.js Server (Replit/Render/VPS)

### Scripts

```bash
npm start       # Start the sync server
npm run sync    # Run sync once (no server)
npm run server  # Same as npm start
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Health check with uptime and sync status |
| `/sync` | Manual sync trigger |
| `/status` | Detailed status with proxy info |

### Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key  
- `TMDB_API_KEY` - TMDB API key

Optional:
- `PORT` - Server port (default: 5000)
- `CRON_SCHEDULE` - Cron expression (default: "*/1 * * * *")
- `USE_PROXY` - Enable proxy ("true"/"false")
- `PROXY_LIST` - Comma-separated proxies
- `TOONSTREAM_HOME_URL` - Source URL

---

## Proxy Support (Node.js only)

```bash
# Option 1: Environment variable
USE_PROXY=true
PROXY_LIST=host1:port1,host2:port2

# Option 2: File
# Create proxy.txt with one proxy per line
```

Proxy format: `host:port` or `host:port:username:password`

---

## Secrets Kahan Se Milenge?

### Supabase Credentials

1. https://supabase.com/dashboard
2. Project select karo
3. **Settings** > **API**
4. Copy karo:
   - **URL** = `SUPABASE_URL`
   - **service_role key** = `SUPABASE_SERVICE_ROLE_KEY`

### TMDB API Key

1. https://www.themoviedb.org/settings/api
2. Account banao
3. API key generate karo

---

## File Structure

```
toonstream-cloudflare/
├── src/
│   └── index.js              # Cloudflare Workers code
├── wrangler.toml             # Cloudflare config
├── sync-server.js            # Node.js Express server
├── toonstream-supabase-sync.js  # Node.js sync logic
├── proxy-manager.js          # Proxy rotation (Node.js)
├── package.json
└── README.md
```

---

## Troubleshooting

### Cloudflare Logs

```bash
wrangler tail
```

### Local Testing (Cloudflare)

```bash
npm run dev
```

### Secrets Update

```bash
wrangler secret put SECRET_NAME
```
