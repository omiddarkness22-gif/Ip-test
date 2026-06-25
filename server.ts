import express from "express";
import path from "path";
import https from "https";
import http from "http";
import net from "net";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for TCP Ping
function tcpPing(ip: string, port: number, timeout: number = 1500): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    
    socket.setTimeout(timeout);
    
    socket.connect(port, ip, () => {
      const latency = Date.now() - startTime;
      socket.destroy();
      resolve(latency);
    });
    
    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Timeout"));
    });
  });
}

// Helper for HTTP/HTTPS Trace Ping
function httpPing(
  ip: string,
  port: number,
  timeout: number = 2000,
  tls: boolean = true,
  hostHeader?: string,
  customPath?: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const requestModule = tls ? https : http;
    
    const options: any = {
      hostname: ip,
      port: port,
      path: customPath || "/cdn-cgi/trace",
      method: "GET",
      timeout: timeout,
      rejectUnauthorized: false,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    
    const targetHost = hostHeader || "speed.cloudflare.com";
    options.headers["Host"] = targetHost;
    if (tls) {
      options.servername = targetHost; // Sets TLS SNI
    }
    
    const req = requestModule.request(options, (res) => {
      res.on("data", () => {}); // Consume response
      res.on("end", () => {
        const latency = Date.now() - startTime;
        resolve(latency);
      });
    });
    
    req.on("error", (err) => {
      reject(err);
    });
    
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    
    req.end();
  });
}

// Helper for Speed Test
function testSpeed(
  ip: string,
  port: number,
  tls: boolean = true,
  hostHeader?: string,
  downloadBytes: number = 1572864, // 1.5MB default
  timeout: number = 8000,
  customUrl?: string
): Promise<{ speedBytesPerSec: number; bytesDownloaded: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    let isTls = tls;
    let targetPort = port;
    let targetPath = `/__down?bytes=${downloadBytes}`;
    let targetHost = hostHeader || "speed.cloudflare.com";
    let byteLimit = downloadBytes;

    if (customUrl) {
      try {
        const parsed = new URL(customUrl);
        isTls = parsed.protocol === "https:";
        targetHost = parsed.hostname;
        targetPort = parsed.port ? Number(parsed.port) : (isTls ? 443 : 80);
        targetPath = parsed.pathname + parsed.search;
        // Limit custom downloads to 3MB max to prevent huge data use during speed testing
        byteLimit = Math.min(downloadBytes, 3 * 1048576);
      } catch (e: any) {
        reject(new Error("Invalid custom URL: " + e.message));
        return;
      }
    }

    const requestModule = isTls ? https : http;
    
    const options: any = {
      hostname: ip,
      port: targetPort,
      path: targetPath,
      method: "GET",
      timeout: timeout,
      rejectUnauthorized: false,
      headers: {
        "Host": targetHost,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Encoding": "identity" // Ensure raw bytes are received
      }
    };
    
    if (isTls) {
      options.servername = targetHost;
    }
    
    let bytesDownloaded = 0;
    const requestStartTime = Date.now();
    let isFinished = false;

    const cleanupAndResolve = () => {
      if (isFinished) return;
      isFinished = true;
      const durationMs = Date.now() - requestStartTime;
      const durationSec = durationMs / 1000;
      const speedBytesPerSec = bytesDownloaded / (durationSec || 0.1);
      resolve({
        speedBytesPerSec,
        bytesDownloaded,
        durationMs
      });
    };
    
    const req = requestModule.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP Status ${res.statusCode}`));
        return;
      }
      
      // Limit speed test to maximum 4 seconds per IP
      const speedTimeout = setTimeout(() => {
        req.destroy();
        cleanupAndResolve();
      }, 4000);

      res.on("data", (chunk) => {
        bytesDownloaded += chunk.length;
        if (bytesDownloaded >= byteLimit) {
          clearTimeout(speedTimeout);
          req.destroy();
          cleanupAndResolve();
        }
      });
      
      res.on("end", () => {
        clearTimeout(speedTimeout);
        cleanupAndResolve();
      });
    });
    
    req.on("error", (err) => {
      if (!isFinished) {
        reject(err);
      }
    });
    
    req.on("timeout", () => {
      req.destroy();
      if (!isFinished) {
        reject(new Error("Timeout"));
      }
    });
    
    req.end();
  });
}

// API Route: Ping Batch of IPs (with Concurrency Control)
app.post("/api/scan/ping", async (req, res) => {
  const { ips, port, timeout, tls, hostHeader, customPath, testType } = req.body;
  
  if (!Array.isArray(ips) || ips.length === 0) {
    res.status(400).json({ error: "Invalid or empty IP list" });
    return;
  }
  
  const targetPort = Number(port) || 443;
  const targetTimeout = Number(timeout) || 1500;
  const isTls = tls !== false;
  const targetTestType = testType || "tcp"; // "tcp" or "http"
  
  // Controlled concurrency scanning
  const concurrencyLimit = 15;
  const results: Array<{ ip: string; latency?: number; success: boolean; error?: string }> = [];
  
  let index = 0;
  async function worker() {
    while (index < ips.length) {
      const currentIndex = index++;
      const ip = ips[currentIndex];
      
      try {
        let latency: number;
        if (targetTestType === "tcp") {
          latency = await tcpPing(ip, targetPort, targetTimeout);
        } else {
          latency = await httpPing(ip, targetPort, targetTimeout, isTls, hostHeader, customPath);
        }
        results[currentIndex] = { ip, latency, success: true };
      } catch (err: any) {
        results[currentIndex] = { ip, success: false, error: err.message || "Failed" };
      }
    }
  }
  
  const workers = Array.from({ length: Math.min(concurrencyLimit, ips.length) }, worker);
  await Promise.all(workers);
  
  res.json({ results });
});

// API Route: Test Speed for a Single IP
app.post("/api/scan/speed", async (req, res) => {
  const { ip, port, tls, hostHeader, downloadSizeMb, customUrl } = req.body;
  
  if (!ip) {
    res.status(400).json({ error: "IP address is required" });
    return;
  }
  
  const targetPort = Number(port) || 443;
  const isTls = tls !== false;
  // Convert MB to bytes (1MB = 1048576 bytes)
  const sizeMb = Number(downloadSizeMb) || 1.5;
  const downloadBytes = Math.round(sizeMb * 1048576);
  
  try {
    let result;
    let fallbackUsed = false;
    let originalError = "";

    if (customUrl) {
      try {
        result = await testSpeed(ip, targetPort, isTls, hostHeader, downloadBytes, 8000, customUrl);
      } catch (err: any) {
        originalError = err.message || "Custom URL speed test failed";
        // Fallback to standard Cloudflare speed test on the same IP
        result = await testSpeed(ip, 443, true, "speed.cloudflare.com", downloadBytes, 8000);
        fallbackUsed = true;
      }
    } else {
      result = await testSpeed(ip, targetPort, isTls, hostHeader, downloadBytes, 8000);
    }

    const speedMbps = (result.speedBytesPerSec * 8) / 1000000;
    const speedMbPerSec = result.speedBytesPerSec / 1000000;
    
    res.json({
      success: true,
      ip,
      speedMbps: Number(speedMbps.toFixed(2)),
      speedMbPerSec: Number(speedMbPerSec.toFixed(2)),
      bytesDownloaded: result.bytesDownloaded,
      durationMs: result.durationMs,
      fallbackUsed,
      originalError: fallbackUsed ? originalError : undefined
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      ip,
      error: err.message || "Speed test failed"
    });
  }
});

// Start Server & Integrate Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cloudflare Scanner Server running on http://localhost:${PORT}`);
  });
}

startServer();
