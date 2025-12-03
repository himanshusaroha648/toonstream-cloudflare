import { createClient } from "@supabase/supabase-js";

const MAX_SUBREQUESTS = 45;
let subrequestCount = 0;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function getUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function canFetch() {
  return subrequestCount < MAX_SUBREQUESTS;
}

async function fetchHtml(url) {
  if (!canFetch()) {
    throw new Error("Subrequest limit reached");
  }
  subrequestCount++;
  console.log(`📊 Subrequests: ${subrequestCount}/${MAX_SUBREQUESTS}`);
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": getUA(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://toonstream.one/",
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.text();
}

function extractEpisodesFromHomepage(html) {
  const episodes = [];
  const seen = new Set();
  
  const linkRegex = /href=["'](https?:\/\/toonstream\.one\/episode\/([^"'\/]+)\/?)['"]/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const slug = match[2].replace(/\/$/, '');
    
    if (seen.has(slug)) continue;
    seen.add(slug);
    
    const codeMatch = slug.match(/^(.+)-(\d+)x(\d+)$/i);
    if (!codeMatch) {
      console.log(`   ⏭️ Skipping invalid slug: ${slug}`);
      continue;
    }
    
    const animeSlug = codeMatch[1];
    const season = parseInt(codeMatch[2], 10);
    const episode = parseInt(codeMatch[3], 10);
    const anime = animeSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    episodes.push({
      id: `${animeSlug}-s${season}e${episode}`,
      anime,
      animeSlug,
      season,
      episode,
      url,
    });
  }
  
  console.log(`   📋 Extracted episodes: ${episodes.map(e => e.id).join(', ')}`);
  return episodes;
}

function extractTrembedUrls(html) {
  const urls = [];
  const seen = new Set();
  
  const iframeRegex = /<iframe[^>]*(?:src|data-src)=["']([^"']*trembed[^"']*)["'][^>]*>/gi;
  let match;
  
  while ((match = iframeRegex.exec(html)) !== null) {
    let url = match[1].replace(/&#038;/g, '&').replace(/&amp;/g, '&');
    
    if (url.startsWith('/')) {
      url = 'https://toonstream.one' + url;
    } else if (!url.startsWith('http')) {
      url = 'https://toonstream.one/' + url;
    }
    
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  
  return urls;
}

async function resolveVideoUrl(trembedUrl, depth = 0) {
  if (depth > 3 || !canFetch()) {
    return null;
  }
  
  try {
    console.log(`   🔍 [Depth ${depth}] Resolving: ${trembedUrl.substring(0, 60)}...`);
    const html = await fetchHtml(trembedUrl);
    
    const iframeMatches = [...html.matchAll(/<iframe[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)];
    
    for (const match of iframeMatches) {
      let embedUrl = match[1];
      
      if (embedUrl.startsWith('//')) {
        embedUrl = 'https:' + embedUrl;
      }
      
      if (!embedUrl.includes('toonstream.one') && !embedUrl.includes('trembed') && !embedUrl.includes('trid=')) {
        console.log(`      ✓ Found video: ${embedUrl.substring(0, 50)}...`);
        return embedUrl;
      }
      
      if (embedUrl.includes('trembed') || embedUrl.includes('trid=')) {
        const resolved = await resolveVideoUrl(embedUrl, depth + 1);
        if (resolved) return resolved;
      }
    }
    
    const locationMatch = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i) ||
                          html.match(/location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i);
    
    if (locationMatch) {
      let redirectUrl = locationMatch[1];
      if (redirectUrl.startsWith('//')) {
        redirectUrl = 'https:' + redirectUrl;
      }
      if (!redirectUrl.includes('toonstream.one') && !redirectUrl.includes('trembed')) {
        console.log(`      ✓ Found redirect: ${redirectUrl.substring(0, 50)}...`);
        return redirectUrl;
      }
    }
    
    return null;
  } catch (err) {
    console.warn(`      ⚠️ Failed: ${err.message}`);
    return null;
  }
}

async function getProgress(env) {
  try {
    const data = await env.PROGRESS.get("sync_progress", { type: "json" });
    return data || { last_index: 0 };
  } catch {
    return { last_index: 0 };
  }
}

async function saveProgress(env, lastIndex) {
  await env.PROGRESS.put("sync_progress", JSON.stringify({
    last_index: lastIndex,
    updated_at: new Date().toISOString(),
  }));
}

async function runSync(env) {
  subrequestCount = 0;
  
  console.log("🚀 Toonstream -> Supabase sync started");
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  let html;
  try {
    console.log("📡 Fetching homepage...");
    html = await fetchHtml("https://toonstream.one/");
  } catch (err) {
    console.error(`❌ Failed to fetch homepage: ${err.message}`);
    return { success: false, error: err.message };
  }
  
  const episodes = extractEpisodesFromHomepage(html);
  console.log(`🔍 Found ${episodes.length} episodes on homepage`);
  
  if (episodes.length === 0) {
    return { success: true, synced: 0, skipped: 0 };
  }
  
  const progress = await getProgress(env);
  let startIndex = progress.last_index;
  
  if (startIndex >= episodes.length) {
    startIndex = 0;
    console.log("🔄 Resetting progress - starting from beginning");
  } else {
    console.log(`📍 Resuming from index: ${startIndex}`);
  }
  
  let syncedCount = 0;
  let skippedCount = 0;
  let processedIndex = startIndex;
  
  for (let i = startIndex; i < episodes.length; i++) {
    if (!canFetch()) {
      console.log(`❌ Subrequest limit hit at index ${i}, saving progress...`);
      await saveProgress(env, i);
      break;
    }
    
    const ep = episodes[i];
    processedIndex = i;
    
    const { data: existing } = await supabase
      .from("episodes")
      .select("id")
      .eq("series_slug", ep.animeSlug)
      .eq("season", ep.season)
      .eq("episode", ep.episode)
      .single();
    
    if (existing) {
      console.log(`⏭️ Skipping ${ep.anime} S${ep.season}E${ep.episode} (already exists)`);
      skippedCount++;
      continue;
    }
    
    console.log(`➡️ Processing: ${ep.anime} S${ep.season}E${ep.episode}`);
    
    if (!canFetch()) {
      console.log(`❌ Limit hit before fetching episode page`);
      await saveProgress(env, i);
      break;
    }
    
    let episodeHtml;
    try {
      episodeHtml = await fetchHtml(ep.url);
    } catch (err) {
      console.warn(`   ⚠️ Failed to fetch episode page: ${err.message}`);
      continue;
    }
    
    const trembedUrls = extractTrembedUrls(episodeHtml);
    console.log(`   📺 Found ${trembedUrls.length} server options`);
    
    if (trembedUrls.length === 0) {
      console.warn(`   ⚠️ No servers found`);
      continue;
    }
    
    let videoUrl = null;
    for (const trembedUrl of trembedUrls) {
      if (!canFetch()) {
        console.log(`   ❌ Limit hit during server resolution`);
        break;
      }
      
      videoUrl = await resolveVideoUrl(trembedUrl, 0);
      if (videoUrl) break;
    }
    
    if (!videoUrl) {
      console.warn(`   ⚠️ No working video found`);
      continue;
    }
    
    const { data: existingSeries } = await supabase
      .from("series")
      .select("id")
      .eq("slug", ep.animeSlug)
      .single();
    
    if (!existingSeries) {
      const { error: seriesErr } = await supabase
        .from("series")
        .insert({
          slug: ep.animeSlug,
          title: ep.anime,
          status: "Ongoing",
        });
      
      if (seriesErr) {
        console.warn(`   ⚠️ Failed to create series: ${seriesErr.message}`);
      } else {
        console.log(`   📺 Created series: ${ep.anime}`);
      }
    }
    
    const episodeData = {
      series_slug: ep.animeSlug,
      season: ep.season,
      episode: ep.episode,
      title: `${ep.anime} S${ep.season}E${ep.episode}`,
      servers: [{ option: 1, real_video: videoUrl }],
    };
    
    const { error: upsertErr } = await supabase
      .from("episodes")
      .upsert(episodeData, { onConflict: "series_slug,season,episode" });
    
    if (upsertErr) {
      console.error(`   ❌ Failed to save: ${upsertErr.message}`);
      continue;
    }
    
    await supabase
      .from("latest_episodes")
      .upsert({
        series_slug: ep.animeSlug,
        series_title: ep.anime,
        season: ep.season,
        episode: ep.episode,
        episode_title: episodeData.title,
        added_at: new Date().toISOString(),
      }, { onConflict: "series_slug,season,episode" });
    
    console.log(`✅ Synced ${ep.anime} S${ep.season}E${ep.episode}`);
    syncedCount++;
  }
  
  if (processedIndex >= episodes.length - 1) {
    await saveProgress(env, 0);
    console.log("🔄 All episodes processed, resetting progress");
  }
  
  console.log(`\n📊 Sync complete: ${syncedCount} synced, ${skippedCount} skipped`);
  console.log(`📊 Subrequests used: ${subrequestCount}/${MAX_SUBREQUESTS}`);
  
  return {
    success: true,
    synced: syncedCount,
    skipped: skippedCount,
    subrequests: subrequestCount,
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "alive",
        service: "Toonstream Supabase Sync",
        timestamp: new Date().toISOString(),
        endpoints: {
          "/": "Health check",
          "/sync": "Trigger manual sync (POST)",
          "/file": "View progress",
          "/reset": "Reset progress",
        },
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (url.pathname === "/sync" && request.method === "POST") {
      ctx.waitUntil(runSync(env));
      return new Response(JSON.stringify({
        status: "triggered",
        message: "Sync started in background",
        timestamp: new Date().toISOString(),
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (url.pathname === "/file") {
      const progress = await getProgress(env);
      return new Response(JSON.stringify(progress, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (url.pathname === "/reset") {
      await saveProgress(env, 0);
      return new Response(JSON.stringify({
        status: "reset",
        message: "Progress reset to 0",
        timestamp: new Date().toISOString(),
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response("Not Found", { status: 404 });
  },
  
  async scheduled(event, env, ctx) {
    console.log(`⏰ Scheduled sync at ${new Date().toISOString()}`);
    ctx.waitUntil(runSync(env));
  },
};
