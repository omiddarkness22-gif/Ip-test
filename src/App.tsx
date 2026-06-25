import { useState, useEffect, useMemo } from "react";
import { Language, IPScanResult, TestType } from "./types";
import { IpManagerTab } from "./components/IpManagerTab";
import { ConfigGeneratorTab } from "./components/ConfigGeneratorTab";
import { 
  Play, 
  RotateCcw, 
  Activity, 
  Settings, 
  ListFilter, 
  TrendingUp, 
  Globe, 
  Download, 
  CheckCircle, 
  XCircle, 
  Search, 
  Heart, 
  Sparkles, 
  Terminal, 
  Share2, 
  Info,
  ChevronDown,
  Trash2,
  Copy,
  Plus
} from "lucide-react";

// Default clean Cloudflare IPs to seed on the first load if empty
const INITIAL_IPS = [
  "172.67.73.1",
  "104.16.85.12",
  "104.21.34.192",
  "162.159.36.12",
  "188.114.96.22",
  "141.101.114.42"
];

export default function App() {
  // Theme and Language
  const [language, setLanguage] = useState<Language>("fa");
  
  // IP List and Scan State
  const [rawIps, setRawIps] = useState<string>("");
  const [ipsToScan, setIpsToScan] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<IPScanResult[]>([]);
  
  // Scan settings
  const [port, setPort] = useState<number>(443);
  const [testType, setTestType] = useState<TestType>(TestType.TCP);
  const [timeoutMs, setTimeoutMs] = useState<number>(1500);
  const [useTls, setUseTls] = useState<boolean>(true);
  const [hostHeader, setHostHeader] = useState<string>("speed.cloudflare.com");
  
  // Favorites IPs
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [sortBy, setSortBy] = useState<"latency" | "speed" | "ip">("latency");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Scanning Process State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanError, setScanError] = useState<string>("");
  
  // Active Speed Test State
  const [testingSpeedIp, setTestingSpeedIp] = useState<string | null>(null);
  const [speedTestProgress, setSpeedTestProgress] = useState<number>(0); // 0 to 100 %
  
  // Batch Speed Test State & Custom Download URL
  const [customSpeedUrl, setCustomSpeedUrl] = useState<string>(
    "https://www.dl.farsroid.com/ap/Rotation-Control-Pro-7.3.1(www.Farsroid.com).apk"
  );
  const [isBatchTestingSpeed, setIsBatchTestingSpeed] = useState<boolean>(false);
  const [batchSpeedProgress, setBatchSpeedProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const [activeTab, setActiveTab] = useState<"scanner" | "ips" | "configs">("scanner");

  const isEn = language === "en";

  // Persian and English translations
  const t = {
    appName: isEn ? "Cloudflare Clean IP Scanner" : "اسکنر آی‌پی تمیز کلادفلر",
    appSlogan: isEn ? "Bypass Censorship, Find Fastest IPs, Connect Safely" : "دور زدن فیلترینگ، یافتن سریع‌ترین آی‌پی‌های لبه و اتصال ایمن",
    langToggle: isEn ? "FA" : "EN",
    tabScanner: isEn ? "Scanning Workbench" : "میز کار اسکن",
    tabIps: isEn ? "IP Generator" : "تولید و مدیریت آی‌پی",
    tabConfigs: isEn ? "VPN Config Creator" : "شخصی‌سازی کانفیگ VPN",
    
    // Custom Speed Test Translations
    customSpeedUrlLabel: isEn ? "Speed Test Download File" : "فایل دانلود تست سرعت",
    customSpeedUrlDesc: isEn 
      ? "Downloads this file via each IP to calculate download rate (MB/s)." 
      : "جهت سنجش واقعی سرعت دانلود، از این لینک به عنوان فایل دانلودی در تمامی آی‌پی‌ها استفاده می‌شود.",
    batchSpeedTestBtn: isEn ? "Speed Test All Clean IPs" : "تست سرعت گروهی آی‌پی‌های تمیز",
    batchSpeedTesting: isEn ? "Testing All..." : "در حال تست گروهی...",
    batchSpeedProgressText: (current: number, total: number) => 
      isEn ? `Testing speed of IP ${current} of ${total}...` : `در حال سنجش سرعت آی‌پی ${current} از ${total}...`,
    
    // Config panel
    settingsHeader: isEn ? "Scan Options" : "تنظیمات اسکنر",
    portLabel: isEn ? "Port" : "پورت مقصد",
    testTypeLabel: isEn ? "Verification Protocol" : "روش تست اتصال",
    timeoutLabel: isEn ? "Timeout (ms)" : "حداکثر زمان انتظار (میلی‌ثانیه)",
    hostLabel: isEn ? "Host SNI (HTTP)" : "آدرس SNI / هاست",
    tlsLabel: isEn ? "Use TLS Security" : "استفاده از TLS/SSL",
    ipInputLabel: isEn ? "Custom IP addresses (Newlines or commas)" : "لیست آی‌پی‌های دلخواه (جدا شده با خط جدید یا کاما)",
    ipInputPlaceholder: isEn ? "e.g., 104.16.85.12\n172.67.73.1" : "مثال:\n104.16.85.12\n172.67.73.1",
    addBtn: isEn ? "Import to List" : "وارد کردن به لیست تست",
    importSuccess: isEn ? "IP addresses imported!" : "آی‌پی‌ها با موفقیت وارد شدند!",
    
    // Actions
    startScan: isEn ? "Start Network Diagnostics" : "شروع تست پینگ و کیفیت",
    scanning: isEn ? "Testing Latency..." : "درحال ارزیابی پینگ...",
    resetList: isEn ? "Clear Workbench" : "پاکسازی لیست تست",
    resultsHeader: isEn ? "Network Diagnostic Results" : "نتایج ارزیابی شبکه",
    totalIps: isEn ? "Total Targets" : "کل آی‌پی‌ها",
    successfulIps: isEn ? "Clean IPs" : "آی‌پی‌های فعال",
    failedIps: isEn ? "Unreachable" : "قطع / فیلتر",
    
    // Table headers & Filters
    searchPlaceholder: isEn ? "Search IP addresses..." : "جستجوی آی‌پی...",
    filterAll: isEn ? "Show All" : "نمایش همه",
    filterSuccess: isEn ? "Clean Only" : "فقط فعال‌ها",
    filterFailed: isEn ? "Failed Only" : "فقط ناموفق‌ها",
    sortByLatency: isEn ? "Sort by Latency" : "مرتب‌سازی بر اساس پینگ",
    sortBySpeed: isEn ? "Sort by Speed" : "مرتب‌سازی بر اساس سرعت",
    sortByIp: isEn ? "Sort by IP" : "مرتب‌سازی بر اساس آی‌پی",
    
    // IP Card Row
    latency: isEn ? "Ping" : "پینگ",
    speed: isEn ? "Speed" : "سرعت",
    actions: isEn ? "Actions" : "عملیات",
    speedTestBtn: isEn ? "Speed Test" : "تست سرعت واقعی",
    speedTestingState: isEn ? "Measuring..." : "اندازه‌گیری...",
    favoriteBtn: isEn ? "Save" : "ذخیره در علاقه‌مندی",
    unfavoriteBtn: isEn ? "Saved" : "ذخیره شده",
    noIps: isEn ? "Testing workbench is empty. Generate IPs or paste them to begin." : "لیست تست خالی است. ابتدا تعدادی آی‌پی وارد کنید یا از بخش مولد آی‌پی بسازید.",
    copied: isEn ? "Copied!" : "کپی شد!",
    copyIP: isEn ? "Copy IP" : "کپی آی‌پی",
    deleteIP: isEn ? "Delete" : "حذف از لیست",
    
    // Speed dial labels
    speedHeading: isEn ? "Cloudflare Edge Bandwidth speed test" : "سنجش سرعت پهنای باند لبه کلادفلر",
    speedDesc: isEn 
      ? "Downloads small payloads directly from the edge IP to estimate real connection speeds. Run this on clean, low-latency IPs."
      : "دریافت بسته‌های آزمایشی مستقیم از آی‌پی موردنظر جهت برآورد سرعت واقعی دانلود. روی آی‌پی‌های با پینگ پایین اجرا کنید.",
    speedResult: isEn ? "Speed Result" : "نتیجه تست سرعت"
  };

  // Load state from local storage on mount
  useEffect(() => {
    const savedFavs = localStorage.getItem("cf_favorites");
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }
    const savedIps = localStorage.getItem("cf_ips_to_scan");
    if (savedIps) {
      const parsed = JSON.parse(savedIps);
      if (parsed.length > 0) {
        setIpsToScan(parsed);
      } else {
        setIpsToScan(INITIAL_IPS);
      }
    } else {
      setIpsToScan(INITIAL_IPS);
    }
  }, []);

  // Sync favorites
  const handleToggleFavorite = (ip: string) => {
    let updated: string[];
    if (favorites.includes(ip)) {
      updated = favorites.filter(f => f !== ip);
    } else {
      updated = [...favorites, ip];
    }
    setFavorites(updated);
    localStorage.setItem("cf_favorites", JSON.stringify(updated));
  };

  const handleRemoveFavorite = (ip: string) => {
    const updated = favorites.filter(f => f !== ip);
    setFavorites(updated);
    localStorage.setItem("cf_favorites", JSON.stringify(updated));
  };

  // Import IPs
  const handleImportIps = (ipsList: string[]) => {
    const cleanList = ipsList
      .map(ip => ip.trim())
      .filter(ip => {
        // Simple IP regex validation
        const regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        return regex.test(ip);
      });

    if (cleanList.length > 0) {
      const merged = Array.from(new Set([...ipsToScan, ...cleanList]));
      setIpsToScan(merged);
      localStorage.setItem("cf_ips_to_scan", JSON.stringify(merged));
      // Populate fresh results state with success as false/pending
      const freshResults = merged.map(ip => {
        const existing = scanResults.find(r => r.ip === ip);
        return existing || { ip, success: false };
      });
      setScanResults(freshResults);
    }
  };

  const handleClearWorkbench = () => {
    setIpsToScan([]);
    setScanResults([]);
    localStorage.setItem("cf_ips_to_scan", JSON.stringify([]));
  };

  const handleDeleteSingleIp = (ipToDelete: string) => {
    const updatedIps = ipsToScan.filter(ip => ip !== ipToDelete);
    setIpsToScan(updatedIps);
    setScanResults(scanResults.filter(r => r.ip !== ipToDelete));
    localStorage.setItem("cf_ips_to_scan", JSON.stringify(updatedIps));
  };

  // Launch Ping Tests (Full Batch scan)
  const handleStartScan = async () => {
    if (ipsToScan.length === 0 || isScanning) return;
    setIsScanning(true);
    setScanProgress(5);
    setScanError("");

    // Initialize/Reset scan results to "pending" look
    const initialPendingResults: IPScanResult[] = ipsToScan.map(ip => ({
      ip,
      success: false,
      latency: undefined,
      error: isEn ? "Pending..." : "در انتظار..."
    }));
    setScanResults(initialPendingResults);

    try {
      setScanProgress(20);
      const response = await fetch("/api/scan/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ips: ipsToScan,
          port,
          timeout: timeoutMs,
          tls: useTls,
          hostHeader,
          testType
        })
      });

      setScanProgress(80);
      if (!response.ok) {
        throw new Error(isEn ? "Failed to query test server." : "خطا در برقراری ارتباط با سرور تست.");
      }

      const data = await response.json();
      setScanProgress(100);

      if (data.results) {
        setScanResults(data.results);
      }
    } catch (err: any) {
      setScanError(err.message || (isEn ? "An unexpected error occurred." : "خطای نامشخص رخ داد."));
    } finally {
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(0);
      }, 800);
    }
  };

  // Helper to execute speed test for a single IP (can be awaited sequentially)
  const runSpeedTestForIp = async (ip: string): Promise<boolean> => {
    setTestingSpeedIp(ip);
    setSpeedTestProgress(10);
    
    // Update IP card state to testing speed
    setScanResults(prev => prev.map(r => r.ip === ip ? { ...r, speedTesting: true } : r));

    // Progress animation simulation
    const interval = setInterval(() => {
      setSpeedTestProgress(p => p < 90 ? p + 15 : p);
    }, 400);

    try {
      const response = await fetch("/api/scan/speed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip,
          port,
          tls: useTls,
          hostHeader,
          downloadSizeMb: 1.5, // 1.5 MB download limit
          customUrl: customSpeedUrl
        })
      });

      clearInterval(interval);
      setSpeedTestProgress(100);

      if (!response.ok) {
        throw new Error(isEn ? "Failed speed test response." : "خطا در تست سرعت.");
      }

      const data = await response.json();
      if (data.success) {
        setScanResults(prev => prev.map(r => r.ip === ip ? {
          ...r,
          speedMbps: data.speedMbps,
          speedMbPerSec: data.speedMbPerSec,
          speedTesting: false,
          speedTested: true,
          fallbackUsed: data.fallbackUsed,
          error: undefined
        } : r));
        return true;
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch (err: any) {
      setScanResults(prev => prev.map(r => r.ip === ip ? {
        ...r,
        speedTesting: false,
        speedTested: true,
        error: err.message || "Speed test failed"
      } : r));
      return false;
    } finally {
      setTestingSpeedIp(null);
      setSpeedTestProgress(0);
    }
  };

  // Execute Speed Test for one specific Clean IP
  const handleSpeedTest = async (ip: string) => {
    if (testingSpeedIp || isScanning || isBatchTestingSpeed) return;
    await runSpeedTestForIp(ip);
  };

  // Execute Speed Test sequentially for all Clean/Active IPs
  const handleBatchSpeedTest = async () => {
    if (isScanning || testingSpeedIp || isBatchTestingSpeed) return;
    
    // Gather all currently active/successful IPs
    const cleanIps = scanResults.filter(r => r.success).map(r => r.ip);
    if (cleanIps.length === 0) {
      setScanError(isEn ? "No active clean IPs found to test speed." : "هیچ آی‌پی فعالی برای سنجش سرعت یافت نشد. ابتدا دکمه شروع تست پینگ را بزنید.");
      return;
    }

    setIsBatchTestingSpeed(true);
    setBatchSpeedProgress({ current: 0, total: cleanIps.length });
    setScanError("");

    try {
      for (let i = 0; i < cleanIps.length; i++) {
        const ip = cleanIps[i];
        setBatchSpeedProgress({ current: i + 1, total: cleanIps.length });
        await runSpeedTestForIp(ip);
        // Wait 400ms between IPs to prevent throttling/connection noise
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } catch (err: any) {
      setScanError(err.message || (isEn ? "Batch speed test interrupted." : "تست سرعت گروهی با خطا مواجه شد."));
    } finally {
      setIsBatchTestingSpeed(false);
    }
  };

  // Copy IP address to clipboard helper
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const handleCopyIpToClipboard = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 1500);
  };

  // Compute stats
  const totalCount = ipsToScan.length;
  const cleanCount = scanResults.filter(r => r.success).length;
  const failedCount = scanResults.filter(r => !r.success && r.error && r.error !== "Pending...").length;

  // Filter & Sort results
  const processedResults = useMemo(() => {
    let list = [...scanResults];

    // Filter by search query
    if (searchQuery.trim()) {
      list = list.filter(r => r.ip.includes(searchQuery.trim()));
    }

    // Filter by status
    if (statusFilter === "success") {
      list = list.filter(r => r.success);
    } else if (statusFilter === "failed") {
      list = list.filter(r => !r.success);
    }

    // Sort results
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "latency") {
        const latA = a.success ? (a.latency ?? 9999) : 99999;
        const latB = b.success ? (b.latency ?? 9999) : 99999;
        comparison = latA - latB;
      } else if (sortBy === "speed") {
        const spA = a.speedMbps ?? 0;
        const spB = b.speedMbps ?? 0;
        comparison = spB - spA; // Speed descending normally, we'll swap if order is desc
      } else {
        comparison = a.ip.localeCompare(b.ip);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return list;
  }, [scanResults, searchQuery, statusFilter, sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col selection:bg-indigo-600/30 selection:text-indigo-200" dir={language === "fa" ? "rtl" : "ltr"}>
      
      {/* Top Android Material 3 Style App Bar */}
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-gray-900 py-4 px-6 flex items-center justify-between" id="app-header">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-inner">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white font-sans flex items-center">
              {t.appName}
              <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 ml-2">Android Tool</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium hidden md:block mt-0.5">{t.appSlogan}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          {/* Language toggle switch */}
          <button
            onClick={() => setLanguage(language === "fa" ? "en" : "fa")}
            className="bg-gray-900 border border-gray-800 hover:border-gray-750 text-xs font-bold text-gray-300 px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center space-x-1 space-x-reverse"
          >
            <Globe className="w-3.5 h-3.5 ml-1" />
            <span>{t.langToggle}</span>
          </button>
        </div>
      </header>

      {/* Main navigation tabs */}
      <nav className="max-w-7xl w-full mx-auto px-4 md:px-6 mt-4" id="navigation-tabs">
        <div className="flex p-1.5 bg-gray-900 border border-gray-850 rounded-2xl gap-1">
          <button
            onClick={() => setActiveTab("scanner")}
            className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 space-x-reverse ${
              activeTab === "scanner" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-gray-400 hover:bg-gray-850 hover:text-gray-200"
            }`}
          >
            <Activity className="w-4 h-4 ml-1" />
            <span>{t.tabScanner}</span>
          </button>
          <button
            onClick={() => setActiveTab("ips")}
            className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 space-x-reverse ${
              activeTab === "ips" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-gray-400 hover:bg-gray-850 hover:text-gray-200"
            }`}
          >
            <Plus className="w-4 h-4 ml-1" />
            <span>{t.tabIps}</span>
          </button>
          <button
            onClick={() => setActiveTab("configs")}
            className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center space-x-2 space-x-reverse ${
              activeTab === "configs" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" 
                : "text-gray-400 hover:bg-gray-850 hover:text-gray-200"
            }`}
          >
            <Settings className="w-4 h-4 ml-1" />
            <span>{t.tabConfigs}</span>
          </button>
        </div>
      </nav>

      {/* Active screen content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24">
        
        {activeTab === "scanner" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="scanner-grid">
            
            {/* Left sidebar: Configuration controls */}
            <div className="lg:col-span-4 space-y-6" id="settings-sidebar">
              <div className="bg-gray-900 border border-gray-850 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl pointer-events-none" />
                
                <h2 className="text-md font-bold text-white mb-5 flex items-center font-sans border-b border-gray-850 pb-3">
                  <Settings className="w-4 h-4 ml-2 text-indigo-400" />
                  {t.settingsHeader}
                </h2>

                <div className="space-y-4">
                  {/* Select Verification Protocol */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.testTypeLabel}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTestType(TestType.TCP);
                          setPort(443);
                        }}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          testType === TestType.TCP
                            ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                            : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        TCP Socket Ping
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTestType(TestType.HTTP);
                          setPort(443);
                        }}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                          testType === TestType.HTTP
                            ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                            : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        HTTP Trace (Proxy)
                      </button>
                    </div>
                  </div>

                  {/* Settings grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.portLabel}</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 font-mono text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.timeoutLabel}</label>
                      <input
                        type="number"
                        value={timeoutMs}
                        onChange={(e) => setTimeoutMs(Number(e.target.value))}
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 font-mono text-center"
                      />
                    </div>
                  </div>

                  {/* TLS Security Checkbox */}
                  {testType === TestType.HTTP && (
                    <div className="flex items-center justify-between bg-gray-950 border border-gray-850 p-3 rounded-xl">
                      <span className="text-xs text-gray-300 font-semibold">{t.tlsLabel}</span>
                      <input
                        type="checkbox"
                        checked={useTls}
                        onChange={(e) => setUseTls(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-850 rounded focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {/* HTTP Custom Host / SNI */}
                  {testType === TestType.HTTP && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.hostLabel}</label>
                      <input
                        type="text"
                        value={hostHeader}
                        onChange={(e) => setHostHeader(e.target.value)}
                        placeholder="speed.cloudflare.com"
                        className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}

                  {/* Speed Test Custom Download URL */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-850">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{t.customSpeedUrlLabel}</span>
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    </label>
                    <input
                      type="text"
                      value={customSpeedUrl}
                      onChange={(e) => setCustomSpeedUrl(e.target.value)}
                      placeholder="https://..."
                      dir="ltr"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-[11px] text-gray-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-gray-500 leading-normal">{t.customSpeedUrlDesc}</p>
                  </div>

                  {/* Custom IP input area */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-850">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.ipInputLabel}</label>
                    <textarea
                      value={rawIps}
                      onChange={(e) => setRawIps(e.target.value)}
                      placeholder={t.ipInputPlaceholder}
                      dir="ltr"
                      className="w-full h-24 bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = rawIps.split(/[\s,;\n]+/).filter(Boolean);
                        if (parsed.length > 0) {
                          handleImportIps(parsed);
                          setRawIps("");
                        }
                      }}
                      className="w-full bg-gray-800 hover:bg-gray-750 text-white font-bold text-xs py-2.5 rounded-xl transition-all"
                    >
                      {t.addBtn}
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistics indicator */}
              <div className="bg-gray-900 border border-gray-850 rounded-3xl p-5 shadow-lg flex items-center justify-around text-center">
                <div>
                  <span className="text-xl font-black text-indigo-400 font-mono">{totalCount}</span>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">{t.totalIps}</p>
                </div>
                <div className="w-[1px] h-8 bg-gray-800" />
                <div>
                  <span className="text-xl font-black text-emerald-400 font-mono">{cleanCount}</span>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">{t.successfulIps}</p>
                </div>
                <div className="w-[1px] h-8 bg-gray-800" />
                <div>
                  <span className="text-xl font-black text-rose-400 font-mono">{failedCount}</span>
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">{t.failedIps}</p>
                </div>
              </div>
            </div>

            {/* Right block: Scan diagnostics and listings */}
            <div className="lg:col-span-8 space-y-6" id="scan-workbench">
              
              {/* Scan buttons toolbar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-gray-900 border border-gray-850 rounded-3xl p-4 shadow-xl">
                <button
                  onClick={handleStartScan}
                  disabled={isScanning || isBatchTestingSpeed || !!testingSpeedIp || ipsToScan.length === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 text-white font-bold text-sm px-6 py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <Play className="w-5 h-5 ml-2" />
                  <span>{isScanning ? `${t.scanning} (${scanProgress}%)` : t.startScan}</span>
                </button>

                <button
                  onClick={handleBatchSpeedTest}
                  disabled={isScanning || isBatchTestingSpeed || !!testingSpeedIp || cleanCount === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/30 text-white font-bold text-sm px-6 py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/15 flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <TrendingUp className="w-5 h-5 ml-2" />
                  <span>{isBatchTestingSpeed ? `${t.batchSpeedTesting} (${batchSpeedProgress.current}/${batchSpeedProgress.total})` : t.batchSpeedTestBtn}</span>
                </button>

                <button
                  onClick={handleClearWorkbench}
                  disabled={isScanning || isBatchTestingSpeed || !!testingSpeedIp}
                  className="bg-gray-950 hover:bg-gray-850 border border-gray-800 text-gray-300 font-bold text-xs px-5 py-4 rounded-2xl transition-all flex items-center justify-center space-x-1.5 space-x-reverse"
                >
                  <RotateCcw className="w-4 h-4 ml-1.5" />
                  <span>{t.resetList}</span>
                </button>
              </div>

              {/* Progress bar */}
              {isScanning && (
                <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-850 shadow-inner">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300 shadow-md shadow-indigo-500/50"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              )}

              {/* Batch speed test progress bar */}
              {isBatchTestingSpeed && (
                <div className="space-y-2 bg-emerald-950/10 border border-emerald-900/20 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>{t.batchSpeedProgressText(batchSpeedProgress.current, batchSpeedProgress.total)}</span>
                    <span className="font-mono">{Math.round((batchSpeedProgress.current / batchSpeedProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-850 shadow-inner">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 shadow-md shadow-emerald-500/50"
                      style={{ width: `${(batchSpeedProgress.current / batchSpeedProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error block */}
              {scanError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs font-semibold text-rose-400 flex items-center space-x-2 space-x-reverse">
                  <XCircle className="w-4 h-4 ml-2 text-rose-500" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Advanced Filters & Sorting */}
              <div className="bg-gray-900 border border-gray-850 rounded-3xl p-5 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Search box */}
                  <div className="relative flex-1">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className="w-full bg-gray-950 border border-gray-850 rounded-2xl pr-10 pl-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Status segment control */}
                  <div className="flex bg-gray-950 border border-gray-850 p-1 rounded-2xl gap-1">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                        statusFilter === "all" ? "bg-gray-850 text-white" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t.filterAll}
                    </button>
                    <button
                      onClick={() => setStatusFilter("success")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                        statusFilter === "success" ? "bg-emerald-500/10 text-emerald-400" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t.filterSuccess}
                    </button>
                    <button
                      onClick={() => setStatusFilter("failed")}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${
                        statusFilter === "failed" ? "bg-rose-500/10 text-rose-400" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t.filterFailed}
                    </button>
                  </div>
                </div>

                {/* Sorting Controls */}
                <div className="flex flex-wrap items-center justify-between border-t border-gray-850 pt-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-gray-500 font-medium ml-1 flex items-center">
                      <ListFilter className="w-3.5 h-3.5 ml-1 text-gray-400" />
                      {isEn ? "Sort by:" : "مرتب‌سازی بر اساس:"}
                    </span>
                    <button
                      onClick={() => {
                        if (sortBy === "latency") {
                          setSortOrder(o => o === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy("latency");
                          setSortOrder("asc");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        sortBy === "latency" ? "bg-indigo-600/10 border-indigo-500 text-indigo-400" : "bg-gray-950 border-gray-800 text-gray-400"
                      }`}
                    >
                      {t.sortByLatency} {sortBy === "latency" && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === "speed") {
                          setSortOrder(o => o === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy("speed");
                          setSortOrder("desc");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        sortBy === "speed" ? "bg-indigo-600/10 border-indigo-500 text-indigo-400" : "bg-gray-950 border-gray-800 text-gray-400"
                      }`}
                    >
                      {t.sortBySpeed} {sortBy === "speed" && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === "ip") {
                          setSortOrder(o => o === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy("ip");
                          setSortOrder("asc");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        sortBy === "ip" ? "bg-indigo-600/10 border-indigo-500 text-indigo-400" : "bg-gray-950 border-gray-800 text-gray-400"
                      }`}
                    >
                      {t.sortByIp} {sortBy === "ip" && (sortOrder === "asc" ? "↑" : "↓")}
                    </button>
                  </div>

                  <span className="text-[10px] text-gray-500 font-bold bg-gray-950 border border-gray-850 px-2 py-1 rounded-md">
                    {processedResults.length} {isEn ? "Results" : "آی‌پی"}
                  </span>
                </div>
              </div>

              {/* Dynamic Live Testing Display - IPs Grid List */}
              <div className="space-y-3" id="results-list">
                {processedResults.length === 0 ? (
                  <div className="text-center py-16 bg-gray-900 border border-gray-850 rounded-3xl text-gray-500 font-semibold px-6 flex flex-col items-center justify-center" id="empty-results-fallback">
                    <Activity className="w-12 h-12 text-gray-700 mb-3" />
                    <span>{t.noIps}</span>
                  </div>
                ) : (
                  processedResults.map((result) => {
                    const isFavorite = favorites.includes(result.ip);
                    const isTestingThis = testingSpeedIp === result.ip;
                    
                    // Determine ping strength color
                    let pingColor = "text-gray-400 bg-gray-950 border-gray-850";
                    let pingDot = "bg-gray-600";
                    if (result.success && result.latency) {
                      if (result.latency < 120) {
                        pingColor = "text-emerald-400 bg-emerald-500/5 border-emerald-500/10";
                        pingDot = "bg-emerald-400";
                      } else if (result.latency < 250) {
                        pingColor = "text-amber-400 bg-amber-500/5 border-amber-500/10";
                        pingDot = "bg-amber-400";
                      } else {
                        pingColor = "text-rose-400 bg-rose-500/5 border-rose-500/10";
                        pingDot = "bg-rose-400";
                      }
                    }

                    return (
                      <div
                        key={result.ip}
                        className="bg-gray-900 border border-gray-850 hover:border-gray-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all relative overflow-hidden group"
                        id={`ip-row-${result.ip}`}
                      >
                        {/* Background subtle glowing speed bar when speed testing */}
                        {isTestingThis && (
                          <div 
                            className="absolute bottom-0 right-0 h-1 bg-gradient-to-l from-indigo-500 to-indigo-600 transition-all duration-300" 
                            style={{ width: `${speedTestProgress}%`, left: 0 }}
                          />
                        )}

                        <div className="flex items-center space-x-3 space-x-reverse">
                          <span className={`w-3 h-3 rounded-full ${pingDot} shadow-lg`} />
                          
                          <div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <span className="font-mono text-base md:text-lg font-bold text-white select-all">{result.ip}</span>
                              
                              <button
                                onClick={() => handleCopyIpToClipboard(result.ip)}
                                className="p-1 hover:bg-gray-850 rounded-md transition-colors text-gray-500 hover:text-gray-300"
                                title={t.copyIP}
                              >
                                {copiedIp === result.ip ? (
                                  <span className="text-[10px] text-emerald-400 font-sans font-bold">{t.copied}</span>
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            
                            <div className="flex items-center space-x-2 space-x-reverse mt-1 text-[11px] font-medium text-gray-500">
                              <span>CF Edge IP</span>
                              {result.error && result.error !== "Pending..." && (
                                <span className="text-rose-500 flex items-center">
                                  <XCircle className="w-3 h-3 ml-1" />
                                  {result.error}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Network latency & Speed measurements indicators */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Latency Widget */}
                          {result.success && result.latency !== undefined ? (
                            <div className={`px-3 py-1.5 rounded-2xl border flex items-center space-x-1.5 space-x-reverse text-xs font-bold ${pingColor}`}>
                              <span className="text-[10px] text-gray-500 font-medium">{t.latency}:</span>
                              <span className="font-mono">{result.latency} ms</span>
                            </div>
                          ) : (
                            <div className="px-3 py-1.5 rounded-2xl border border-gray-850 bg-gray-950 text-gray-600 text-xs font-semibold">
                              --
                            </div>
                          )}

                          {/* Real-time Bandwidth speed widget */}
                          {result.success && (
                            <div className="px-3 py-1.5 rounded-2xl border border-gray-850 bg-gray-950 flex items-center space-x-1.5 space-x-reverse text-xs font-bold">
                              <span className="text-[10px] text-gray-500 font-medium">{t.speed}:</span>
                              {result.speedMbps !== undefined ? (
                                <div className="flex items-center space-x-1.5 space-x-reverse">
                                  <span className="text-emerald-400 font-mono">{result.speedMbps} Mbps</span>
                                  {result.fallbackUsed && (
                                    <span 
                                      className="inline-flex w-1.5 h-1.5 rounded-full bg-amber-400" 
                                      title={isEn ? "CDN Fallback Used" : "استفاده از تست پشتیبان کلادفلر"}
                                    />
                                  )}
                                </div>
                              ) : result.speedTesting ? (
                                <span className="text-indigo-400 animate-pulse">{t.speedTestingState}</span>
                              ) : (
                                <span className="text-gray-600 font-mono">--</span>
                              )}
                            </div>
                          )}

                          {/* Action panel */}
                          <div className="flex items-center gap-1.5 pr-2 border-r border-gray-800 mr-2">
                            {/* Save to Favorites toggle */}
                            <button
                              onClick={() => handleToggleFavorite(result.ip)}
                              className={`p-2.5 rounded-xl border transition-all ${
                                isFavorite
                                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                  : "bg-gray-950 border-gray-850 text-gray-500 hover:text-gray-300 hover:border-gray-700"
                              }`}
                              title={isFavorite ? t.unfavoriteBtn : t.favoriteBtn}
                            >
                              <Heart className={`w-4 h-4 ${isFavorite ? "fill-rose-500" : ""}`} />
                            </button>

                            {/* Trigger single speed test */}
                            {result.success && (
                              <button
                                onClick={() => handleSpeedTest(result.ip)}
                                disabled={!!testingSpeedIp || isScanning || isBatchTestingSpeed}
                                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border flex items-center space-x-1.5 space-x-reverse ${
                                  isTestingThis
                                    ? "bg-indigo-600/10 border-indigo-500 text-indigo-400"
                                    : "bg-gray-950 border-gray-850 text-gray-300 hover:bg-gray-850 hover:border-gray-700 disabled:opacity-40"
                                }`}
                              >
                                <Download className="w-3.5 h-3.5 ml-1" />
                                <span>{isTestingThis ? t.speedTestingState : t.speedTestBtn}</span>
                              </button>
                            )}

                            {/* Delete single IP */}
                            <button
                              onClick={() => handleDeleteSingleIp(result.ip)}
                              className="p-2.5 bg-gray-950 hover:bg-rose-950/20 text-gray-600 hover:text-rose-400 border border-gray-850 hover:border-rose-900/30 rounded-xl transition-all"
                              title={t.deleteIP}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Informational Guidelines Card */}
              <div className="bg-gray-900/40 border border-gray-850 rounded-3xl p-6" id="speed-test-disclaimer">
                <div className="flex items-start space-x-3 space-x-reverse">
                  <Info className="w-5 h-5 text-indigo-400 mt-0.5 ml-1.5" />
                  <div>
                    <h5 className="text-xs font-bold text-white mb-1">{t.speedHeading}</h5>
                    <p className="text-[11px] text-gray-400 leading-relaxed mb-3">{t.speedDesc}</p>
                    <p className="text-[10.5px] text-amber-500/90 leading-relaxed border-t border-gray-800/40 pt-2">
                      💡 <strong>{isEn ? "Routing Notice:" : "نکته مسیریابی و تست سرعت:"}</strong>{" "}
                      {isEn 
                        ? "For speed tests, the custom download file must reside behind the Cloudflare network. If the custom URL is hosted externally (e.g., Farsroid in Iran), Cloudflare edge servers will block direct routing. To prevent failures, our server automatically and intelligently falls back to Cloudflare's high-speed global CDN (speed.cloudflare.com) to measure each IP's raw connection quality."
                        : "برای انجام سنجش سرعت واقعی، فایل دانلودی باید بر روی بستر کلادفلر قرار داشته باشد. اگر لینک دانلود خارج از شبکه کلادفلر باشد (مانند سایت فارسروید که در داخل ایران میزبانی می‌شود)، سرورهای کلادفلر اجازه دانلود مستقیم از آن را بدون اتصال فعال VPN نمی‌دهند. به همین دلیل سیستم به صورت خودکار و کاملاً هوشمند ترافیک تست سرعت را روی شبکه اختصاصی و پرسرعت کلادفلر (speed.cloudflare.com) هدایت می‌کند تا همواره سنجش دقیق پهنای باند آی‌پی‌ها تضمین شود."}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* IP Manager tab */}
        {activeTab === "ips" && (
          <IpManagerTab
            language={language}
            onAddIps={handleImportIps}
            favorites={favorites}
            onRemoveFavorite={handleRemoveFavorite}
          />
        )}

        {/* Config Customizer tab */}
        {activeTab === "configs" && (
          <ConfigGeneratorTab
            language={language}
            cleanIps={scanResults}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

      </main>

      {/* Footer credits bar */}
      <footer className="mt-auto py-6 border-t border-gray-900 bg-gray-950 text-center text-xs text-gray-500" id="app-footer-credits">
        <p className="font-sans">
          {isEn ? "Cloudflare Clean IP Scanner - Proactive Diagnostics Workbench" : "سامانه هوشمند تشخیص و اسکن آی‌پی تمیز کلادفلر"}
        </p>
        <p className="text-[10px] text-gray-600 mt-1 font-mono">
          Powered by Gemini AI • React & Tailwind CSS
        </p>
      </footer>
    </div>
  );
}
