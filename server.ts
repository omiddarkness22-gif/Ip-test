import express from "express";
import path from "path";
import https from "https";
import http from "http";
import net from "net";
import crypto from "crypto";
import WebSocket from "ws";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for TCP Ping
function tcpPing(ip: string, port: number, timeout: number = 1500): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    
    let isFinished = false;
    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        reject(new Error("Timeout"));
      }
    }, timeout);
    
    socket.connect(port, ip, () => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        socket.destroy();
        resolve(latency);
      }
    });
    
    socket.on("error", (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      }
    });
  });
}

// Helper for HTTP/HTTPS Trace Ping
interface FullParsedConfig {
  protocol: "vless" | "vmess" | "trojan" | null;
  uuidOrPassword?: string;
  sni?: string;
  host?: string;
  path?: string;
  port?: number;
  tls?: boolean;
}

function parseFullVpnConfig(config: string): FullParsedConfig | null {
  try {
    const trimmed = config.trim();
    if (!trimmed) return null;
    
    if (trimmed.startsWith("vless://") || trimmed.startsWith("trojan://")) {
      const isVless = trimmed.startsWith("vless://");
      const protocol = isVless ? "vless" : "trojan";
      
      let urlPart = trimmed.substring(protocol.length + 3);
      const hashIdx = urlPart.indexOf("#");
      if (hashIdx !== -1) {
        urlPart = urlPart.substring(0, hashIdx);
      }
      
      const atIdx = urlPart.indexOf("@");
      if (atIdx === -1) return null;
      
      const uuidOrPassword = urlPart.substring(0, atIdx);
      const remaining = urlPart.substring(atIdx + 1);
      const qIdx = remaining.indexOf("?");
      const addrPort = qIdx !== -1 ? remaining.substring(0, qIdx) : remaining;
      const queryStr = qIdx !== -1 ? remaining.substring(qIdx + 1) : "";
      
      let parsedSni: string | undefined;
      let parsedPort = 443;
      
      const colonIdx = addrPort.lastIndexOf(":");
      if (colonIdx !== -1) {
        parsedSni = addrPort.substring(0, colonIdx);
        parsedPort = parseInt(addrPort.substring(colonIdx + 1), 10) || 443;
      } else {
        parsedSni = addrPort;
      }
      
      const searchParams = new URLSearchParams(queryStr);
      const sniParam = searchParams.get("sni") || undefined;
      const hostParam = searchParams.get("host") || undefined;
      const pathParam = searchParams.get("path") || undefined;
      const securityParam = searchParams.get("security") || undefined;
      
      const sni = sniParam || hostParam || parsedSni;
      const host = hostParam || sni;
      const path = pathParam ? decodeURIComponent(pathParam) : undefined;
      const tls = securityParam !== "none";
      
      return {
        protocol,
        uuidOrPassword,
        sni,
        host,
        path,
        port: parsedPort,
        tls
      };
    } else if (trimmed.startsWith("vmess://")) {
      const b64Str = trimmed.substring(8).trim();
      const paddedB64 = b64Str + "=".repeat((4 - (b64Str.length % 4)) % 4);
      const decoded = Buffer.from(paddedB64, "base64").toString("utf-8");
      const json_data = JSON.parse(decoded);
      
      const sni = json_data.sni || json_data.host || json_data.add;
      const host = json_data.host || json_data.add;
      const path = json_data.path;
      const port = parseInt(json_data.port, 10) || 443;
      const tls = json_data.tls === "tls";
      
      return {
        protocol: "vmess",
        uuidOrPassword: json_data.id,
        sni,
        host,
        path,
        port,
        tls
      };
    }
  } catch (err) {
    console.error("Error parsing VPN config:", err);
  }
  return null;
}

interface VpnWsResult {
  latency?: number;
  speedBytesPerSec?: number;
  bytesDownloaded?: number;
  durationMs?: number;
  error?: string;
}

function testVpnWs(
  ip: string,
  config: FullParsedConfig,
  action: "ping" | "speed",
  downloadBytes: number = 1024 * 1024, // 1MB default
  timeoutMs: number = 3000,
  testTarget: string = "cloudflare"
): Promise<VpnWsResult> {
  return new Promise((resolve) => {
    const { protocol, uuidOrPassword, sni, host, path, port, tls } = config;
    if (!protocol || (protocol !== "vless" && protocol !== "trojan")) {
      resolve({ error: "Unsupported protocol for direct tunnel scan" });
      return;
    }
    
    const targetPort = port || 443;
    const isTls = tls !== false;
    
    let wsUrl = `${isTls ? "wss" : "ws"}://${ip}:${targetPort}`;
    if (path) {
      let cleanPath = path;
      if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
      wsUrl += cleanPath;
    }
    
    const wsHeaders: any = {
      "Host": host || sni || "speed.cloudflare.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    
    const ws = new WebSocket(wsUrl, {
      headers: wsHeaders,
      servername: sni || host,
      rejectUnauthorized: false,
      handshakeTimeout: timeoutMs
    } as any);
    
    const startTime = Date.now();
    let connectedTime = 0;
    let bytesDownloaded = 0;
    let firstMessageReceived = false;
    let timeoutTimer: NodeJS.Timeout;
    
    const cleanup = () => {
      clearTimeout(timeoutTimer);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    };
    
    timeoutTimer = setTimeout(() => {
      cleanup();
      resolve({ error: "Timeout" });
    }, timeoutMs);
    
    ws.on("open", () => {
      connectedTime = Date.now();
      
      let headerBuf: Buffer;
      
      let targetHost = "speed.cloudflare.com";
      let destPort = 80;
      
      // For Ping, we connect to the requested target (Instagram / Google / Cloudflare)
      // For Speed, we MUST use speed.cloudflare.com because it is the only host that serves a high-speed dummy file generator.
      if (action === "ping") {
        if (testTarget === "instagram") {
          targetHost = "instagram.com";
        } else if (testTarget === "google") {
          targetHost = "www.google.com";
        }
      }
      
      const hostBuffer = Buffer.from(targetHost, "utf-8");
      
      if (protocol === "vless") {
        const uuidHex = (uuidOrPassword || "").replace(/-/g, "");
        if (uuidHex.length !== 32) {
          cleanup();
          resolve({ error: "Invalid UUID format" });
          return;
        }
        const uuidBuffer = Buffer.from(uuidHex, "hex");
        
        headerBuf = Buffer.alloc(1 + 16 + 1 + 1 + 2 + 1 + 1 + hostBuffer.length);
        let offset = 0;
        headerBuf.writeUInt8(0, offset++); // VLESS Version 0
        uuidBuffer.copy(headerBuf, offset); offset += 16; // UUID
        headerBuf.writeUInt8(0, offset++); // Addon length M = 0
        headerBuf.writeUInt8(1, offset++); // Command: 1 (TCP connection)
        headerBuf.writeUInt16BE(destPort, offset); offset += 2; // Port
        headerBuf.writeUInt8(2, offset++); // Address Type: 2 (Domain)
        headerBuf.writeUInt8(hostBuffer.length, offset++); // Host Length
        hostBuffer.copy(headerBuf, offset); offset += hostBuffer.length;
      } else {
        // Trojan Protocol
        const password = uuidOrPassword || "";
        const hashHex = crypto.createHash("sha224").update(password).digest("hex");
        const hashBuf = Buffer.from(hashHex, "ascii");
        
        headerBuf = Buffer.alloc(hashBuf.length + 2 + 1 + 1 + 1 + hostBuffer.length + 2 + 2);
        let offset = 0;
        hashBuf.copy(headerBuf, offset); offset += hashBuf.length; // Password SHA224 hash
        headerBuf.write("\r\n", offset, 2, "ascii"); offset += 2; // CRLF
        headerBuf.writeUInt8(1, offset++); // Command: 1 (TCP)
        headerBuf.writeUInt8(2, offset++); // Address Type: 2 (Domain)
        headerBuf.writeUInt8(hostBuffer.length, offset++); // Host Length
        hostBuffer.copy(headerBuf, offset); offset += hostBuffer.length; // Host bytes
        headerBuf.writeUInt16BE(destPort, offset); offset += 2; // Port
        headerBuf.write("\r\n", offset, 2, "ascii"); offset += 2; // CRLF
      }
      
      // Build HTTP GET Request to send inside the tunnel
      let httpRequestStr = "";
      if (action === "ping") {
        if (targetHost === "speed.cloudflare.com") {
          httpRequestStr = "GET /cdn-cgi/trace HTTP/1.1\r\nHost: speed.cloudflare.com\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n";
        } else {
          httpRequestStr = `GET / HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`;
        }
      } else {
        if (targetHost === "speed.cloudflare.com") {
          httpRequestStr = `GET /__down?bytes=${downloadBytes} HTTP/1.1\r\nHost: speed.cloudflare.com\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`;
        } else {
          httpRequestStr = `GET / HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`;
        }
      }
      const httpPayload = Buffer.from(httpRequestStr, "utf-8");
      const initialFrame = Buffer.concat([headerBuf, httpPayload]);
      
      ws.send(initialFrame, { binary: true }, (err) => {
        if (err) {
          cleanup();
          resolve({ error: "Failed to send handshaking payload" });
        }
      });
    });
    
    ws.on("message", (data: any, isBinary: boolean) => {
      if (!isBinary) return;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      let payload = buf;
      if (!firstMessageReceived) {
        firstMessageReceived = true;
        
        if (protocol === "vless") {
          // VLESS response header: Version (1 byte), Addons length M (1 byte), Addons (M bytes)
          if (buf.length >= 2) {
            const addonLen = buf.readUInt8(1);
            if (buf.length >= 2 + addonLen) {
              payload = buf.subarray(2 + addonLen);
            }
          }
        }
        
        if (action === "ping") {
          const latency = Date.now() - startTime;
          cleanup();
          resolve({ latency });
          return;
        }
      }
      
      bytesDownloaded += payload.length;
      
      if (action === "speed") {
        const elapsed = (Date.now() - connectedTime) / 1000;
        if (bytesDownloaded >= downloadBytes || elapsed >= (timeoutMs / 1000)) {
          const durationMs = Math.max(10, Date.now() - connectedTime);
          const speedBytesPerSec = bytesDownloaded / (durationMs / 1000);
          cleanup();
          resolve({ speedBytesPerSec, bytesDownloaded, durationMs });
        }
      }
    });
    
    ws.on("error", (err) => {
      cleanup();
      resolve({ error: err.message || "WS Connection Error" });
    });
    
    ws.on("close", () => {
      cleanup();
      if (action === "speed" && bytesDownloaded > 1024) {
        const durationMs = Math.max(10, Date.now() - connectedTime);
        const speedBytesPerSec = bytesDownloaded / (durationMs / 1000);
        resolve({ speedBytesPerSec, bytesDownloaded, durationMs });
      } else if (action === "ping" && firstMessageReceived) {
        const latency = Date.now() - startTime;
        resolve({ latency });
      } else {
        resolve({ error: "Closed before receiving valid data" });
      }
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
  customPath?: string,
  sni?: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const requestModule = tls ? https : http;
    
    const options: any = {
      hostname: ip,
      port: port,
      path: customPath || "/cdn-cgi/trace",
      method: "GET",
      rejectUnauthorized: false,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    };
    
    const targetHost = hostHeader || "speed.cloudflare.com";
    options.headers["Host"] = targetHost;
    if (tls) {
      options.servername = sni || targetHost; // Sets TLS SNI
    }
    
    let isFinished = false;
    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        req.destroy();
        reject(new Error("Timeout"));
      }
    }, timeout);
    
    const req = requestModule.request(options, (res) => {
      res.on("data", () => {}); // Consume response
      res.on("end", () => {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          const latency = Date.now() - startTime;
          resolve(latency);
        }
      });
    });
    
    req.on("error", (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        reject(err);
      }
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
  customUrl?: string,
  sni?: string,
  customPath?: string
): Promise<{ speedBytesPerSec: number; bytesDownloaded: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    let isTls = tls;
    let targetPort = port;
    let targetPath = customPath || `/__down?bytes=${downloadBytes}`;
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
      options.servername = sni || targetHost;
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
      
      // Limit speed test to maximum timeout per IP
      const speedTimeout = setTimeout(() => {
        req.destroy();
        cleanupAndResolve();
      }, timeout);

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
  const { ips, port, timeout, tls, hostHeader, customPath, testType, baseConfigUrl, testTarget, pingCount: reqPingCount, concurrencyLimit: reqConcurrencyLimit } = req.body;
  
  if (!Array.isArray(ips) || ips.length === 0) {
    res.status(400).json({ error: "Invalid or empty IP list" });
    return;
  }
  
  const pingCount = Math.min(Math.max(Number(reqPingCount) || 1, 1), 10);
  const concurrencyLimit = Math.min(Math.max(Number(reqConcurrencyLimit) || 10, 1), 50);
  
  let configPort = Number(port) || 443;
  let configTls = tls !== false;
  let configHost = hostHeader || "speed.cloudflare.com";
  let configPath = customPath || "/cdn-cgi/trace";
  let configSni: string | undefined = undefined;

  let parsedConfig: FullParsedConfig | null = null;
  if (baseConfigUrl) {
    parsedConfig = parseFullVpnConfig(baseConfigUrl);
    if (parsedConfig) {
      if (parsedConfig.port) configPort = parsedConfig.port;
      if (parsedConfig.tls !== undefined) configTls = parsedConfig.tls;
      if (parsedConfig.host) configHost = parsedConfig.host;
      if (parsedConfig.path) {
        configPath = parsedConfig.path;
        if (!configPath.startsWith("/")) {
          configPath = "/" + configPath;
        }
      } else {
        configPath = "/cdn-cgi/trace";
      }
      if (parsedConfig.sni) configSni = parsedConfig.sni;
    }
  }

  const targetPort = configPort;
  const targetTimeout = Number(timeout) || 1500;
  const isTls = configTls;
  const targetTestType = testType || "tcp"; // "tcp" or "http"
  
  // Controlled concurrency scanning
  const results: Array<{ 
    ip: string; 
    latency?: number; 
    success: boolean; 
    error?: string;
    pingHistory?: number[];
    packetLoss?: number;
    jitter?: number;
    minLatency?: number;
    maxLatency?: number;
    pingCount?: number;
  }> = [];
  
  let index = 0;
  async function worker() {
    while (index < ips.length) {
      const currentIndex = index++;
      const ip = ips[currentIndex];
      
      const latencies: number[] = [];
      let successCount = 0;
      let failureCount = 0;
      let lastError = "";
      
      for (let c = 0; c < pingCount; c++) {
        if (c > 0) {
          // Small delay between pings to avoid overloading the socket and to measure real interval variation
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        
        try {
          let lat: number;
          if (parsedConfig && (parsedConfig.protocol === "vless" || parsedConfig.protocol === "trojan")) {
            try {
              const wsResult = await testVpnWs(ip, parsedConfig, "ping", 0, targetTimeout, testTarget);
              if (wsResult.latency !== undefined) {
                lat = wsResult.latency;
              } else {
                throw new Error(wsResult.error || "Tunnel connection failed");
              }
            } catch (wsErr) {
              if (targetTestType === "tcp") {
                lat = await tcpPing(ip, targetPort, targetTimeout);
              } else {
                lat = await httpPing(ip, targetPort, targetTimeout, isTls, configHost, configPath, configSni);
              }
            }
          } else {
            if (targetTestType === "tcp") {
              lat = await tcpPing(ip, targetPort, targetTimeout);
            } else {
              lat = await httpPing(ip, targetPort, targetTimeout, isTls, configHost, configPath, configSni);
            }
          }
          latencies.push(lat);
          successCount++;
        } catch (err: any) {
          failureCount++;
          lastError = err.message || "Failed";
        }
      }
      
      if (successCount > 0) {
        const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / successCount);
        const packetLoss = Math.round((failureCount / pingCount) * 100);
        const minLatency = Math.min(...latencies);
        const maxLatency = Math.max(...latencies);
        const jitter = maxLatency - minLatency;
        
        results[currentIndex] = {
          ip,
          latency: avgLatency,
          success: true,
          pingHistory: latencies,
          packetLoss,
          jitter,
          minLatency,
          maxLatency,
          pingCount
        };
      } else {
        results[currentIndex] = {
          ip,
          success: false,
          error: lastError || "Failed",
          packetLoss: 100,
          pingCount
        };
      }
    }
  }
  
  const workers = Array.from({ length: Math.min(concurrencyLimit, ips.length) }, worker);
  await Promise.all(workers);
  
  res.json({ results });
});

// API Route: Test Speed for a Single IP
app.post("/api/scan/speed", async (req, res) => {
  const { ip, port, tls, hostHeader, downloadSizeMb, downloadTimeoutSec, customUrl, baseConfigUrl, testTarget } = req.body;
  
  if (!ip) {
    res.status(400).json({ error: "IP address is required" });
    return;
  }
  
  let configPort = Number(port) || 443;
  let configTls = tls !== false;
  let configHost = hostHeader || "speed.cloudflare.com";
  let configPath: string | undefined = undefined;
  let configSni: string | undefined = undefined;
  
  let parsedConfig: FullParsedConfig | null = null;
  if (baseConfigUrl) {
    parsedConfig = parseFullVpnConfig(baseConfigUrl);
    if (parsedConfig) {
      if (parsedConfig.port) configPort = parsedConfig.port;
      if (parsedConfig.tls !== undefined) configTls = parsedConfig.tls;
      if (parsedConfig.host) configHost = parsedConfig.host;
      if (parsedConfig.path) {
        configPath = parsedConfig.path;
        if (!configPath.startsWith("/")) {
          configPath = "/" + configPath;
        }
      }
      if (parsedConfig.sni) configSni = parsedConfig.sni;
    }
  }

  const targetPort = configPort;
  const isTls = configTls;
  // Convert MB to bytes (1MB = 1048576 bytes)
  const sizeMb = Number(downloadSizeMb) || 1.5;
  const downloadBytes = Math.round(sizeMb * 1048576);
  
  const timeoutSec = Number(downloadTimeoutSec) || 8;
  const timeoutMs = timeoutSec * 1000;
  
  try {
    let result;
    let fallbackUsed = false;
    let originalError = "";

    // Direct Tunnel Speed Test for VLESS and Trojan over WS
    if (parsedConfig && (parsedConfig.protocol === "vless" || parsedConfig.protocol === "trojan")) {
      try {
        const wsResult = await testVpnWs(ip, parsedConfig, "speed", downloadBytes, timeoutMs, testTarget);
        if (wsResult.speedBytesPerSec !== undefined) {
          result = {
            speedBytesPerSec: wsResult.speedBytesPerSec,
            bytesDownloaded: wsResult.bytesDownloaded || 0,
            durationMs: wsResult.durationMs || 0
          };
        } else {
          throw new Error(wsResult.error || "Tunnel speed test failed");
        }
      } catch (err: any) {
        originalError = err.message || "Tunnel speed test failed";
        // Fallback to standard Cloudflare speed test on the same IP
        result = await testSpeed(ip, 443, true, "speed.cloudflare.com", downloadBytes, timeoutMs);
        fallbackUsed = true;
      }
    } else if (customUrl) {
      try {
        result = await testSpeed(ip, targetPort, isTls, configHost, downloadBytes, timeoutMs, customUrl, configSni);
      } catch (err: any) {
        originalError = err.message || "Custom URL speed test failed";
        // Fallback to standard Cloudflare speed test on the same IP
        result = await testSpeed(ip, 443, true, "speed.cloudflare.com", downloadBytes, timeoutMs);
        fallbackUsed = true;
      }
    } else {
      result = await testSpeed(ip, targetPort, isTls, configHost, downloadBytes, timeoutMs, undefined, configSni, configPath);
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
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Cloudflare Scanner Server running on http://localhost:${PORT}`);
  });
}

startServer();
