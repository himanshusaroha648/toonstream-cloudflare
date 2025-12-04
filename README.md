# Toonstream Koyeb Sync

Toonstream scraper + Supabase uploader - **Koyeb ready deployment**

## Features

- Toonstream website se anime episodes scrape karta hai
- TMDB se metadata fetch karta hai (poster, rating, description)
- Supabase database mein store karta hai
- Har 10 minute pe automatic sync (configurable)
- Proxy support (optional)
- **Last 20 minutes ke logs dekhne ka endpoint** (`/list`)

---

## Endpoints

| Endpoint  | Description                          |
|-----------|--------------------------------------|
| `/`       | Health check with uptime and status  |
| `/sync`   | Manual sync trigger                  |
| `/status` | Detailed status with proxy info      |
| `/list`   | **Last 20 minutes ke logs**          |

---

## Koyeb Pe Deploy Kaise Karein

### Method 1: GitHub se Deploy (Recommended)

1. **GitHub pe push karo:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/toonstream-koyeb.git
   git push -u origin main
   ```

2. **Koyeb Dashboard pe jao:**
   - https://app.koyeb.com pe login karo
   - "Create App" click karo
   - "GitHub" select karo
   - Repository select karo: `toonstream-koyeb`

3. **Build settings:**
   - Builder: **Docker**
   - Dockerfile path: `Dockerfile`
   - Port: `8000`

4. **Environment Variables add karo:**
   ```
   SUPABASE_URL = your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
   TMDB_API_KEY = your-tmdb-api-key
   PORT = 8000
   CRON_SCHEDULE = */10 * * * *
   USE_PROXY = false
   ```

5. **Deploy click karo!**

---

### Method 2: Koyeb CLI se Deploy

1. **Koyeb CLI install karo:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | sh
   ```

2. **Login karo:**
   ```bash
   koyeb login
   ```

3. **Secrets create karo:**
   ```bash
   koyeb secrets create SUPABASE_URL --value "https://your-project.supabase.co"
   koyeb secrets create SUPABASE_SERVICE_ROLE_KEY --value "your-service-role-key"
   koyeb secrets create TMDB_API_KEY --value "your-tmdb-api-key"
   ```

4. **Deploy karo:**
   ```bash
   koyeb app create toonstream-sync --git github.com/YOUR_USERNAME/toonstream-koyeb --git-branch main --docker
   ```

---

## /list Endpoint Usage

`/list` endpoint last 20 minutes ke saare logs dikhata hai:

```bash
curl https://your-app.koyeb.app/list
```

**Response example:**
```json
{
  "status": "ok",
  "timeRange": {
    "from": "2024-01-01T10:00:00.000Z",
    "to": "2024-01-01T10:20:00.000Z",
    "durationMinutes": 20
  },
  "summary": {
    "total": 15,
    "errors": 0,
    "warnings": 2,
    "success": 5,
    "info": 8
  },
  "syncStatus": {
    "isRunning": false,
    "lastRunTime": "2024-01-01T10:15:00.000Z",
    "lastRunSuccess": true,
    "totalRuns": 3,
    "successfulRuns": 3,
    "failedRuns": 0
  },
  "logs": [
    {
      "timestamp": "2024-01-01T10:15:00.000Z",
      "type": "success",
      "message": "Sync run #3 completed successfully",
      "data": { "runNumber": 3 }
    }
  ]
}
```

---

## Environment Variables

### Required Variables

| Variable                    | Description                    |
|-----------------------------|--------------------------------|
| `SUPABASE_URL`              | Supabase project URL           |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key      |
| `TMDB_API_KEY`              | TMDB API key                   |

### Server Configuration (Optional)

| Variable       | Default           | Description                              |
|----------------|-------------------|------------------------------------------|
| `PORT`         | `8000`            | Server port (Koyeb auto-sets this)       |
| `CRON_SCHEDULE`| `*/10 * * * *`    | Cron expression for auto sync            |

### Toonstream Configuration (Optional)

| Variable                   | Default                              | Description                       |
|----------------------------|--------------------------------------|-----------------------------------|
| `TOONSTREAM_HOME_URL`      | `https://toonstream.one/home/`       | Main Toonstream homepage URL      |
| `TOONSTREAM_HOME_FALLBACKS`| -                                    | Comma-separated fallback URLs     |
| `TOONSTREAM_AJAX_URL`      | `https://toonstream.one/wp-admin/admin-ajax.php` | AJAX endpoint URL  |
| `TOONSTREAM_COOKIES`       | -                                    | Cookies for authentication        |

### Scraping Configuration (Optional)

| Variable             | Default   | Description                              |
|----------------------|-----------|------------------------------------------|
| `POLL_INTERVAL_MS`   | `60000`   | Polling interval in milliseconds         |
| `MAX_PARALLEL_SERIES`| `4`       | Maximum parallel series fetch            |
| `EMBED_MAX_DEPTH`    | `3`       | Maximum depth for resolving video embeds |

### Proxy Configuration (Optional)

| Variable          | Default                        | Description                          |
|-------------------|--------------------------------|--------------------------------------|
| `USE_PROXY`       | `false`                        | Enable proxy usage                   |
| `PROXY_LIST`      | -                              | Comma-separated proxies              |
| `PROXY_FILE`      | `proxy.txt`                    | Path to proxy file                   |
| `PROXY_VALIDATE`  | `true`                         | Validate proxies before use          |
| `PROXY_TEST_URL`  | `https://ipv4.webshare.io/`    | URL used to test proxy connectivity  |
| `PROXY_MAX_TESTS` | `15`                           | Maximum proxies to test              |

---

## Local Testing

```bash
# .env file create karo
cp .env.example .env

# Values fill karo
nano .env

# Dependencies install karo
npm install

# Server start karo
npm start
```

---

## Troubleshooting

### Port Error
- Koyeb automatically `PORT` environment variable set karta hai
- Make sure code `process.env.PORT` use kar raha hai

### Sync Fail Ho Raha Hai
- `/list` endpoint check karo for detailed logs
- TMDB API key valid hai ya nahi check karo
- Supabase credentials verify karo

### Logs Nahi Dikh Rahe
- App restart ke baad logs reset ho jaate hain
- `/list` sirf last 20 minutes ke logs dikhata hai
