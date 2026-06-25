import React, { useState } from "react";
import { CLOUDFLARE_SUBNETS, POPULAR_CLEAN_IPS, generateIpsFromCidr } from "../data/defaultIps";
import { Language, CloudflareSubnet } from "../types";
import { Copy, Plus, Shuffle, ListPlus, Server, Check, Trash2, Heart } from "lucide-react";

interface IpManagerTabProps {
  language: Language;
  onAddIps: (ips: string[]) => void;
  favorites: string[];
  onRemoveFavorite: (ip: string) => void;
}

export const IpManagerTab: React.FC<IpManagerTabProps> = ({
  language,
  onAddIps,
  favorites,
  onRemoveFavorite
}) => {
  const [selectedSubnet, setSelectedSubnet] = useState<string>(CLOUDFLARE_SUBNETS[0].cidr);
  const [generateCount, setGenerateCount] = useState<number>(30);
  const [customCidr, setCustomCidr] = useState<string>("");
  const [copiedPreset, setCopiedPreset] = useState<boolean>(false);
  const [addedMessage, setAddedMessage] = useState<string>("");

  const isEn = language === "en";

  const t = {
    subnetsHeader: isEn ? "Cloudflare Subnets IP Generator" : "تولید آی‌پی از رنج‌های کلادفلر",
    subnetsSub: isEn 
      ? "Generate random IP addresses within official Cloudflare subnet CIDR blocks." 
      : "تولید آدرس‌های آی‌پی تصادفی از رنج‌های رسمی و ثبت‌شده کلادفلر.",
    selectSubnet: isEn ? "Select Subnet Range" : "انتخاب رنج آی‌پی",
    ipCount: isEn ? "Number of IPs to Generate" : "تعداد آی‌پی برای تولید",
    generateBtn: isEn ? "Generate & Add to List" : "تولید و افزودن به لیست تست",
    customCidrLabel: isEn ? "Or Enter Custom CIDR" : "یا وارد کردن رنج دلخواه (CIDR)",
    customCidrPlaceholder: "e.g., 104.16.0.0/16",
    presetsHeader: isEn ? "Popular Clean IP Presets" : "لیست آی‌پی‌های تمیز پیشنهادی",
    presetsSub: isEn 
      ? "Add well-known Cloudflare IP addresses optimized for general speed and low latency." 
      : "افزودن مستقیم آی‌پی‌های شناخته‌شده و بهینه‌سازی شده کلادفلر.",
    addPresetsBtn: isEn ? "Add 50 Preset IPs" : "افزودن ۵۰ آی‌پی پیشنهادی",
    favoritesHeader: isEn ? "Saved Clean IPs (Favorites)" : "آی‌پی‌های تمیز ذخیره شده (علاقه‌مندی‌ها)",
    favoritesSub: isEn 
      ? "Your bookmarked IPs. You can easily copy or push them to the testing workbench." 
      : "آی‌پی‌های برگزیده شما. می‌توانید به راحتی آن‌ها را کپی کرده یا به لیست تست بفرستید.",
    noFavorites: isEn ? "No favorite IPs saved yet." : "هیچ آی‌پی ذخیره‌شده‌ای وجود ندارد.",
    addToTest: isEn ? "Send to Test List" : "فرستادن به لیست تست",
    copyAll: isEn ? "Copy All" : "کپی همه",
    copied: isEn ? "Copied!" : "کپی شد!",
    successAdded: (count: number) => isEn ? `Successfully added ${count} IPs to scan list!` : `تعداد ${count} آی‌پی با موفقیت به لیست تست اضافه شد!`
  };

  const handleGenerate = () => {
    const rangeToUse = customCidr.trim() || selectedSubnet;
    if (!rangeToUse) return;

    const generated = generateIpsFromCidr(rangeToUse, generateCount);
    if (generated.length > 0) {
      onAddIps(generated);
      triggerSuccessMessage(t.successAdded(generated.length));
      setCustomCidr("");
    } else {
      triggerSuccessMessage(isEn ? "Invalid CIDR range." : "رنج وارد شده معتبر نیست.");
    }
  };

  const handleAddPresets = () => {
    onAddIps(POPULAR_CLEAN_IPS);
    triggerSuccessMessage(t.successAdded(POPULAR_CLEAN_IPS.length));
  };

  const triggerSuccessMessage = (msg: string) => {
    setAddedMessage(msg);
    setTimeout(() => {
      setAddedMessage("");
    }, 4000);
  };

  const handleCopyFavorites = () => {
    if (favorites.length === 0) return;
    navigator.clipboard.writeText(favorites.join("\n"));
    setCopiedPreset(true);
    setTimeout(() => setCopiedPreset(false), 2000);
  };

  return (
    <div className="space-y-6" id="ip-manager-root">
      {/* Alert toast for dynamic actions */}
      {addedMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg border border-emerald-500 flex items-center space-x-2 animate-bounce" id="toast-message">
          <Check className="w-5 h-5 ml-1" />
          <span className="font-sans text-sm font-medium">{addedMessage}</span>
        </div>
      )}

      {/* Cloudflare Subnet Generator */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl" id="subnet-generator-card">
        <div className="flex items-start space-x-4 ml-2 mb-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
            <Shuffle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-sans">{t.subnetsHeader}</h3>
            <p className="text-xs text-gray-400 mt-1">{t.subnetsSub}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400">{t.selectSubnet}</label>
            <select
              value={selectedSubnet}
              onChange={(e) => {
                setSelectedSubnet(e.target.value);
                setCustomCidr("");
              }}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              {CLOUDFLARE_SUBNETS.map((sub) => (
                <option key={sub.cidr} value={sub.cidr}>
                  {sub.name} ({sub.cidr}) - {isEn ? sub.description : sub.descriptionFa}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400">{t.customCidrLabel}</label>
            <input
              type="text"
              value={customCidr}
              onChange={(e) => setCustomCidr(e.target.value)}
              placeholder={t.customCidrPlaceholder}
              className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-850">
          <div className="w-full sm:w-auto flex items-center space-x-4">
            <span className="text-xs text-gray-400 font-semibold">{t.ipCount}:</span>
            <div className="flex items-center space-x-2">
              {[15, 30, 50, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setGenerateCount(num)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    generateCount === num
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-950 text-gray-400 border border-gray-800 hover:border-gray-700"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4 ml-1" />
            <span>{t.generateBtn}</span>
          </button>
        </div>
      </div>

      {/* Popular Presets Block */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl" id="preset-ips-card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start space-x-4 ml-2">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl">
              <ListPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-sans">{t.presetsHeader}</h3>
              <p className="text-xs text-gray-400 mt-1">{t.presetsSub}</p>
            </div>
          </div>

          <button
            onClick={handleAddPresets}
            className="bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-sm px-6 py-3 rounded-2xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center space-x-2"
          >
            <Server className="w-4 h-4 ml-1" />
            <span>{t.addPresetsBtn}</span>
          </button>
        </div>
      </div>

      {/* Favorites List */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl" id="favorites-ips-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-start space-x-4 ml-2">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl">
              <Heart className="w-6 h-6 fill-rose-500/10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-sans">{t.favoritesHeader}</h3>
              <p className="text-xs text-gray-400 mt-1">{t.favoritesSub}</p>
            </div>
          </div>

          {favorites.length > 0 && (
            <button
              onClick={handleCopyFavorites}
              className="bg-gray-950 text-gray-300 border border-gray-800 hover:bg-gray-850 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
            >
              {copiedPreset ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPreset ? t.copied : t.copyAll}</span>
            </button>
          )}
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-10 bg-gray-950 rounded-2xl border border-dashed border-gray-800 text-gray-500 text-sm font-medium">
            {t.noFavorites}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-gray-950 p-4 rounded-2xl border border-gray-850 max-h-72 overflow-y-auto">
            {favorites.map((ip) => (
              <div
                key={ip}
                className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-gray-300 hover:border-gray-700 transition-all"
              >
                <span className="font-mono select-all font-semibold">{ip}</span>
                <div className="flex items-center space-x-1.5 ml-2">
                  <button
                    onClick={() => onAddIps([ip])}
                    title={t.addToTest}
                    className="p-1 hover:text-indigo-400 transition-colors text-gray-500"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveFavorite(ip)}
                    className="p-1 hover:text-rose-400 transition-colors text-gray-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
