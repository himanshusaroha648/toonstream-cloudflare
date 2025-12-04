import express from "express";
import cron from "node-cron";
import { start as runSyncScript } from "./toonstream-supabase-sync.js";

const app = express();
const PORT = process.env.PORT || 8000;

const logs = [];
const MAX_LOG_AGE_MS = 20 * 60 * 1000;
const MAX_LOGS = 5000;

const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

function cleanupOldLogs() {
  const now = Date.now();
  while (logs.length > 0 && new Date(logs[0].timestamp).getTime() < now - MAX_LOG_AGE_MS) {
    logs.shift();
  }
  while (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

function captureLog(type, args) {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  if (!message.trim()) return;
  
  logs.push({
    timestamp: new Date().toISOString(),
    type,
    message: message.trim(),
  });
  
  cleanupOldLogs();
}

console.log = (...args) => {
  captureLog('log', args);
  originalConsoleLog(...args);
};

console.error = (...args) => {
  captureLog('error', args);
  originalConsoleError(...args);
};

console.warn = (...args) => {
  captureLog('warn', args);
  originalConsoleWarn(...args);
};

let syncStatus = {
  isRunning: false,
  lastRunTime: null,
  lastRunSuccess: null,
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  nextRunTime: null,
};

app.get("/", (req, res) => {
  res.json({
    status: "alive",
    service: "Toonstream Supabase Sync (Koyeb)",
    uptime: process.uptime(),
    syncStatus,
    timestamp: new Date().toISOString(),
    endpoints: {
      "/": "Health check",
      "/sync": "Manual sync trigger",
      "/status": "Detailed status",
      "/list": "View last 20 minutes logs (all console output)",
    },
  });
});

app.get("/list", (req, res) => {
  const now = Date.now();
  const cutoff = now - MAX_LOG_AGE_MS;
  
  const recentLogs = logs.filter(log => new Date(log.timestamp).getTime() >= cutoff);
  
  const summary = {
    total: recentLogs.length,
    errors: recentLogs.filter(l => l.type === 'error').length,
    warnings: recentLogs.filter(l => l.type === 'warn').length,
    logs: recentLogs.filter(l => l.type === 'log').length,
  };
  
  res.json({
    status: "ok",
    timeRange: {
      from: new Date(cutoff).toISOString(),
      to: new Date(now).toISOString(),
      durationMinutes: 20,
    },
    summary,
    syncStatus,
    logs: recentLogs.slice().reverse(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/sync", async (req, res) => {
  if (syncStatus.isRunning) {
    return res.json({
      status: "already_running",
      message: "Sync is already in progress",
      syncStatus,
    });
  }

  console.log("📋 Manual sync triggered via /sync endpoint");
  res.json({
    status: "triggered",
    message: "Sync started manually",
  });

  runSync();
});

app.get("/status", (req, res) => {
  res.json({
    syncStatus,
    proxyEnabled: process.env.USE_PROXY === "true",
    pollInterval: process.env.POLL_INTERVAL_MS || "600000",
    syncIntervalMinutes: 10,
    logsCount: logs.length,
    timestamp: new Date().toISOString(),
  });
});

async function runSync() {
  if (syncStatus.isRunning) {
    console.warn("⏭️ Sync already running, skipping...");
    return;
  }

  syncStatus.isRunning = true;
  syncStatus.lastRunTime = new Date().toISOString();
  syncStatus.totalRuns++;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Starting sync run #${syncStatus.totalRuns}`);
  console.log(`⏰ Time: ${syncStatus.lastRunTime}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    await runSyncScript();

    syncStatus.lastRunSuccess = true;
    syncStatus.successfulRuns++;
    console.log("\n✅ Sync completed successfully\n");
  } catch (error) {
    syncStatus.lastRunSuccess = false;
    syncStatus.failedRuns++;
    console.error(`\n❌ Sync failed: ${error.message}\n`);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    syncStatus.isRunning = false;
  }
}

const cronExpression = process.env.CRON_SCHEDULE || "*/10 * * * *";
cron.schedule(cronExpression, () => {
  console.log("\n⏰ Scheduled sync triggered by cron");
  runSync();
});

function updateNextRunTime() {
  const now = new Date();
  const next = new Date(now.getTime() + 600000);
  syncStatus.nextRunTime = next.toISOString();
}

setInterval(updateNextRunTime, 600000);
updateNextRunTime();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Toonstream Sync Server Started (Koyeb Ready)`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`⏰ Sync schedule: ${cronExpression}`);
  console.log(`🔐 Proxy enabled: ${process.env.USE_PROXY === "true" ? "Yes" : "No"}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
  console.log(`📋 Logs (last 20 min): http://localhost:${PORT}/list`);
  console.log(`🔄 Manual trigger: http://localhost:${PORT}/sync`);
  console.log(`${"=".repeat(60)}\n`);

  console.log("🎬 Running initial sync...\n");
  runSync();
});

process.on("SIGTERM", () => {
  console.warn("⚠️ SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.warn("⚠️ SIGINT received, shutting down gracefully...");
  process.exit(0);
});
