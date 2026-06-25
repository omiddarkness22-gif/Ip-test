import React, { useState, useEffect } from "react";
import { Language, IPScanResult, VpnConfig } from "../types";
import { Copy, Check, Settings, Code, FileText, ArrowRight, HelpCircle, RefreshCw } from "lucide-react";

interface ConfigGeneratorTabProps {
  language: Language;
  cleanIps: IPScanResult[];
  favorites: string[];
  onToggleFavorite: (ip: string) => void;
}

export const ConfigGeneratorTab: React.FC<ConfigGeneratorTabProps> = ({
  language,
  cleanIps,
  favorites,
  onToggleFavorite
}) => {
  const [rawConfig, setRawConfig] = useState<string>("");
  const [parsedConfig, setParsedConfig] = useState<VpnConfig | null>(null);
  const [parseError, setParseError] = useState<string>("");
  const [generatedConfigs, setGeneratedConfigs] = useState<Array<{ ip: string; url: string; delay?: number }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const isEn = language === "en";

  const t = {
    title: isEn ? "Cloudflare VPN Config Customizer" : "شخصی‌سازی کانفیگ VPN با آی‌پی کلادفلر",
    subtitle: isEn 
      ? "Paste your VLESS, Trojan, or VMess config, select your clean IPs, and instantly generate optimized proxy configurations." 
      : "کانفیگ خام خود (VLESS، VMess، Trojan) را وارد کرده و با ترکیب آی‌پی‌های تمیز اسکن‌شده، کانفیگ‌های نهایی بسازید.",
    inputPlaceholder: isEn 
      ? "Paste your VPN Link here (vless://, trojan://, vmess://)..." 
      : "لینک کانفیگ خود را اینجا وارد کنید (مثلا vless://)...",
    parseSuccess: isEn ? "Config parsed successfully!" : "کانفیگ با موفقیت شناسایی شد!",
    invalidConfig: isEn ? "Invalid config URL format." : "فرمت لینک وارد شده نامعتبر است.",
    parseBtn: isEn ? "Analyze Config" : "آنالیز و بررسی کانفیگ",
    detailsHeader: isEn ? "Config Specifications" : "مشخصات فنی کانفیگ",
    protocolLabel: isEn ? "Protocol" : "پروتکل",
    hostLabel: isEn ? "Original Host / SNI" : "آدرس اصلی / SNI",
    portLabel: isEn ? "Port" : "پورت",
    pathLabel: isEn ? "Path" : "مسیر (Path)",
    remarksLabel: isEn ? "Remarks (Name)" : "نام کانفیگ",
    noCleanIps: isEn 
      ? "No clean IPs found. Run a scan first or add presets in IP Manager!" 
      : "هیچ آی‌پی تمیزی یافت نشد. ابتدا اسکن کنید یا از بخش مدیریت آی‌پی به لیست تست بیفزایید!",
    generateHeader: isEn ? "Generated Configs with Clean IPs" : "کانفیگ‌های تولید شده با آی‌پی‌های تمیز",
    generateSub: isEn 
      ? "Select from successful clean IPs to output functional client settings." 
      : "کانفیگ‌های نهایی بهینه‌شده آماده برای کپی و استفاده در نرم‌افزارها (v2rayNG, Nekobox, Shadowrocket)",
    copyAllBtn: isEn ? "Copy All Configurations" : "کپی همه‌ی کانفیگ‌ها به صورت یکجا",
    copyBtn: isEn ? "Copy Link" : "کپی لینک",
    copied: isEn ? "Copied!" : "کپی شد!",
    howItWorksTitle: isEn ? "How does this work?" : "چگونه کار می‌کند؟",
    howItWorksDesc: isEn
      ? "A VPN config communicates with a target domain through a Cloudflare CDN IP. By replacing the destination domain with a pre-scanned 'Clean Cloudflare IP' while maintaining the host headers and SNI, you bypass censorship, improve speeds, and reduce connection drops."
      : "یک کانفیگ کلادفلر از طریق یک آی‌پی لبه به دامنه اصلی شما متصل می‌شود. با جایگزینی دامنه مقصد با یک «آی‌پی تمیز کلادفلر» و همزمان نگه داشتن SNI و Host روی دامنه اصلی، فیلترینگ دور زده شده و سرعت اتصال فوق‌العاده افزایش می‌یابد."
  };

  const handleParse = (inputVal?: string) => {
    const value = (inputVal || rawConfig).trim();
    if (!value) return;

    setParseError("");
    setParsedConfig(null);

    try {
      if (value.startsWith("vless://") || value.startsWith("trojan://")) {
        // vless://uuid@domain:port?params#remarks
        const protocol = value.startsWith("vless://") ? "vless" : "trojan";
        const urlPart = value.substring(protocol.length + 3);
        
        // Find split indices
        const atIdx = urlPart.indexOf("@");
        const hashIdx = urlPart.indexOf("#");
        
        if (atIdx === -1) {
          setParseError(t.invalidConfig);
          return;
        }

        const uuidOrPassword = urlPart.substring(0, atIdx);
        
        let remaining = hashIdx !== -1 ? urlPart.substring(atIdx + 1, hashIdx) : urlPart.substring(atIdx + 1);
        const remarks = hashIdx !== -1 ? decodeURIComponent(urlPart.substring(hashIdx + 1)) : "Clean Cloudflare";

        const questionIdx = remaining.indexOf("?");
        let addressPortStr = questionIdx !== -1 ? remaining.substring(0, questionIdx) : remaining;
        let queryStr = questionIdx !== -1 ? remaining.substring(questionIdx + 1) : "";

        const colonIdx = addressPortStr.lastIndexOf(":");
        if (colonIdx === -1) {
          setParseError(t.invalidConfig);
          return;
        }

        const address = addressPortStr.substring(0, colonIdx);
        const port = parseInt(addressPortStr.substring(colonIdx + 1), 10);

        const params: Record<string, string> = {};
        if (queryStr) {
          const pairs = queryStr.split("&");
          pairs.forEach(p => {
            const [k, v] = p.split("=");
            if (k) params[k] = v || "";
          });
        }

        setParsedConfig({
          raw: value,
          protocol,
          uuid: uuidOrPassword,
          address,
          port,
          params,
          remarks
        });
      } else if (value.startsWith("vmess://")) {
        // vmess://base64encoded
        const base64Str = value.substring(8).trim();
        const decodedStr = atob(base64Str);
        const json = JSON.parse(decodedStr);

        const params: Record<string, string> = {};
        if (json.host) params["host"] = json.host;
        if (json.path) params["path"] = json.path;
        if (json.tls) params["tls"] = json.tls;
        if (json.sni) params["sni"] = json.sni;
        if (json.net) params["net"] = json.net;

        setParsedConfig({
          raw: value,
          protocol: "vmess",
          uuid: json.id,
          address: json.add,
          port: Number(json.port) || 443,
          params,
          remarks: json.ps || "Clean Cloudflare"
        });
      } else {
        setParseError(t.invalidConfig);
      }
    } catch (err: any) {
      setParseError(isEn ? `Failed to parse: ${err.message}` : "خطا در تجزیه لینک کانفیگ. مطمئن شوید فرمت لینک درست است.");
    }
  };

  useEffect(() => {
    if (!parsedConfig) {
      setGeneratedConfigs([]);
      return;
    }

    // Generate modified configs using scanned clean IPs or presets
    const ipsToUse = cleanIps.filter(r => r.success).map(r => ({ ip: r.ip, latency: r.latency })) || [];
    
    // If no scanned clean IPs, use favorites
    if (ipsToUse.length === 0 && favorites.length > 0) {
      favorites.forEach(f => {
        ipsToUse.push({ ip: f, latency: undefined });
      });
    }

    const configs = ipsToUse.map(({ ip, latency }) => {
      let modifiedUrl = "";
      const remarksSuffix = latency ? ` (Ping: ${latency}ms)` : "";
      const cleanRemarks = `${parsedConfig.remarks} - CF: ${ip}${remarksSuffix}`;

      if (parsedConfig.protocol === "vless" || parsedConfig.protocol === "trojan") {
        // Prepare query parameters
        const updatedParams = { ...parsedConfig.params };
        
        // Ensure SNI and Host are preserved with original domain
        if (!updatedParams["sni"]) {
          updatedParams["sni"] = parsedConfig.address;
        }
        if (!updatedParams["host"]) {
          updatedParams["host"] = parsedConfig.address;
        }

        const queryParts = Object.entries(updatedParams).map(([k, v]) => `${k}=${v}`);
        const queryStr = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

        modifiedUrl = `${parsedConfig.protocol}://${parsedConfig.uuid}@${ip}:${parsedConfig.port}${queryStr}#${encodeURIComponent(cleanRemarks)}`;
      } else if (parsedConfig.protocol === "vmess") {
        const vmessJson = {
          v: "2",
          ps: cleanRemarks,
          add: ip,
          port: String(parsedConfig.port),
          id: parsedConfig.uuid,
          aid: "0",
          scy: "auto",
          net: parsedConfig.params["net"] || "ws",
          type: "none",
          host: parsedConfig.params["host"] || parsedConfig.address,
          path: parsedConfig.params["path"] || "",
          tls: parsedConfig.params["tls"] || "tls",
          sni: parsedConfig.params["sni"] || parsedConfig.address
        };
        modifiedUrl = `vmess://${btoa(JSON.stringify(vmessJson))}`;
      }

      return {
        ip,
        url: modifiedUrl,
        delay: latency
      };
    });

    setGeneratedConfigs(configs);
  }, [parsedConfig, cleanIps, favorites]);

  const handleCopyOne = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    if (generatedConfigs.length === 0) return;
    const allUrls = generatedConfigs.map(c => c.url).join("\n");
    navigator.clipboard.writeText(allUrls);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-6" id="config-generator-root">
      {/* Title block */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl" id="config-top-intro">
        <div className="flex items-start space-x-4 ml-2">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <Settings className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-sans">{t.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{t.subtitle}</p>
          </div>
        </div>

        {/* Input box */}
        <div className="mt-6 space-y-4">
          <textarea
            value={rawConfig}
            onChange={(e) => {
              setRawConfig(e.target.value);
              if (e.target.value) handleParse(e.target.value);
            }}
            placeholder={t.inputPlaceholder}
            dir="ltr"
            className="w-full h-24 bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none transition-all"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {parseError && (
              <span className="text-xs text-rose-400 font-semibold">{parseError}</span>
            )}
            {parsedConfig && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center">
                <Check className="w-4 h-4 ml-1" />
                {t.parseSuccess} ({parsedConfig.protocol.toUpperCase()})
              </span>
            )}
            {!parseError && !parsedConfig && <span />}

            <button
              onClick={() => handleParse()}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-all shadow-md"
            >
              {t.parseBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Grid of details & how it works */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="config-grid">
        {/* Analyzed Config Specs */}
        {parsedConfig && (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-1 h-fit" id="config-specs-card">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center">
              <Code className="w-4 h-4 ml-2 text-indigo-400" />
              {t.detailsHeader}
            </h4>

            <div className="space-y-4 text-xs font-sans">
              <div className="flex justify-between py-2 border-b border-gray-850">
                <span className="text-gray-500">{t.protocolLabel}</span>
                <span className="font-bold text-indigo-400 uppercase">{parsedConfig.protocol}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-850">
                <span className="text-gray-500">{t.portLabel}</span>
                <span className="font-mono font-bold text-gray-300">{parsedConfig.port}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-850">
                <span className="text-gray-500">TLS</span>
                <span className={`font-bold ${parsedConfig.params["tls"] === "none" ? "text-rose-400" : "text-emerald-400"}`}>
                  {parsedConfig.params["tls"] || "tls"}
                </span>
              </div>
              <div className="flex flex-col py-2 border-b border-gray-850 space-y-1">
                <span className="text-gray-500">{t.hostLabel}</span>
                <span className="font-mono font-bold text-gray-300 break-all text-right select-all">{parsedConfig.address}</span>
              </div>
              {parsedConfig.params["path"] && (
                <div className="flex flex-col py-2 border-b border-gray-850 space-y-1">
                  <span className="text-gray-500">{t.pathLabel}</span>
                  <span className="font-mono text-gray-400 break-all text-right select-all">{decodeURIComponent(parsedConfig.params["path"])}</span>
                </div>
              )}
              <div className="flex flex-col py-2 space-y-1">
                <span className="text-gray-500">{t.remarksLabel}</span>
                <span className="font-semibold text-gray-300 text-right">{parsedConfig.remarks}</span>
              </div>
            </div>
          </div>
        )}

        {/* Explain Card */}
        <div className={`bg-gray-900/60 border border-gray-800 rounded-3xl p-6 shadow-xl ${parsedConfig ? "lg:col-span-2" : "lg:col-span-3"}`} id="how-it-works-card">
          <h4 className="text-sm font-bold text-white mb-3 flex items-center">
            <HelpCircle className="w-4 h-4 ml-2 text-indigo-400" />
            {t.howItWorksTitle}
          </h4>
          <p className="text-xs text-gray-400 leading-relaxed font-sans">{t.howItWorksDesc}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-850 flex flex-col justify-between">
              <span className="text-indigo-400 font-bold text-lg font-mono">01</span>
              <p className="text-xs text-gray-300 font-medium mt-2">
                {isEn ? "Paste original VPN configuration URL" : "قرار دادن لینک کانفیگ وی‌پی‌ان خام"}
              </p>
            </div>
            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-850 flex flex-col justify-between">
              <span className="text-indigo-400 font-bold text-lg font-mono">02</span>
              <p className="text-xs text-gray-300 font-medium mt-2">
                {isEn ? "IP changes to Cloudflare Clean IPs" : "اسکن و انتخاب آی‌پی تمیز و پرسرعت کلادفلر"}
              </p>
            </div>
            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-850 flex flex-col justify-between">
              <span className="text-indigo-400 font-bold text-lg font-mono">03</span>
              <p className="text-xs text-gray-300 font-medium mt-2">
                {isEn ? "Import clean config into v2rayNG/Nekobox" : "کپی و ورود مستقیم به v2rayNG/Nekobox"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Config list */}
      {parsedConfig && (
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl" id="generated-configs-container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-850 pb-6 mb-6">
            <div>
              <h4 className="text-md font-bold text-white font-sans flex items-center">
                <FileText className="w-5 h-5 ml-2 text-indigo-400" />
                {t.generateHeader}
              </h4>
              <p className="text-xs text-gray-400 mt-1">{t.generateSub}</p>
            </div>

            {generatedConfigs.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {copiedAll ? <Check className="w-4 h-4 ml-1" /> : <Copy className="w-4 h-4 ml-1" />}
                <span>{copiedAll ? t.copied : t.copyAllBtn}</span>
              </button>
            )}
          </div>

          {generatedConfigs.length === 0 ? (
            <div className="text-center py-10 bg-gray-950 rounded-2xl border border-dashed border-gray-800 text-gray-500 text-sm font-medium">
              {t.noCleanIps}
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {generatedConfigs.map((cfg, index) => (
                <div
                  key={`${cfg.ip}-${index}`}
                  className="bg-gray-950 border border-gray-850 hover:border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center space-x-3 ml-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/20" />
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-sm font-bold text-gray-200 select-all">{cfg.ip}</span>
                        {cfg.delay && (
                          <span className="bg-emerald-500/10 text-emerald-400 font-mono text-xs font-semibold px-2 py-0.5 rounded-lg">
                            {cfg.delay} ms
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-gray-500 truncate max-w-lg mt-1 select-all" dir="ltr">
                        {cfg.url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyOne(cfg.url, index)}
                      className="flex-1 md:flex-none bg-gray-900 text-gray-300 hover:bg-gray-850 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 border border-gray-800"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />
                          <span className="text-emerald-400">{t.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 ml-1" />
                          <span>{t.copyBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
