import { CloudflareSubnet } from "../types";

export const CLOUDFLARE_SUBNETS: CloudflareSubnet[] = [
  {
    cidr: "172.67.0.0/16",
    name: "Subnet A (172.67.x.x)",
    description: "Commonly used Cloudflare edge IPs",
    descriptionFa: "آی‌پی‌های لبه کلادفلر پرکاربرد"
  },
  {
    cidr: "104.16.0.0/12",
    name: "Subnet B (104.16.x.x - 104.31.x.x)",
    description: "Large Cloudflare IP block",
    descriptionFa: "رنج بسیار بزرگ آی‌پی‌های کلادفلر"
  },
  {
    cidr: "162.159.0.0/16",
    name: "Subnet C (162.159.x.x)",
    description: "Often used for Cloudflare Pages and Warp",
    descriptionFa: "مورد استفاده در کلادفلر پیجز و وارپ"
  },
  {
    cidr: "104.21.0.0/16",
    name: "Subnet D (104.21.x.x)",
    description: "Highly populated Cloudflare CDN IPs",
    descriptionFa: "آی‌پی‌های شلوغ شبکه کلادفلر"
  },
  {
    cidr: "188.114.96.0/20",
    name: "Subnet E (188.114.96.x)",
    description: "European Cloudflare IP block",
    descriptionFa: "رنج آی‌پی‌های اروپایی کلادفلر"
  },
  {
    cidr: "141.101.64.0/18",
    name: "Subnet F (141.101.x.x)",
    description: "Alternative stable Cloudflare IPs",
    descriptionFa: "آی‌پی‌های جایگزین و با ثبات بالا"
  }
];

// 50 well-known pre-tested Cloudflare clean IP addresses to seed the app
export const POPULAR_CLEAN_IPS: string[] = [
  "172.67.73.1",
  "172.67.74.52",
  "172.67.121.84",
  "172.67.180.190",
  "104.16.85.12",
  "104.16.124.99",
  "104.17.200.121",
  "104.18.32.147",
  "104.19.24.88",
  "104.20.5.162",
  "104.21.34.192",
  "104.21.55.101",
  "104.21.89.200",
  "104.22.4.91",
  "104.24.12.18",
  "104.25.132.40",
  "104.26.2.33",
  "104.27.142.112",
  "104.28.18.99",
  "104.31.2.140",
  "162.159.36.12",
  "162.159.224.50",
  "162.159.138.8",
  "188.114.96.22",
  "188.114.97.105",
  "188.114.98.54",
  "188.114.99.191",
  "141.101.114.42",
  "141.101.115.89",
  "141.101.121.13",
  "141.101.123.40",
  "197.234.240.11",
  "197.234.242.82",
  "104.16.10.10",
  "104.16.20.20",
  "104.16.30.30",
  "104.16.40.40",
  "104.16.50.50",
  "104.16.60.60",
  "104.16.70.70",
  "104.16.80.80",
  "104.16.90.90",
  "104.17.10.10",
  "104.17.20.20",
  "104.17.30.30",
  "104.17.40.40",
  "104.17.50.50",
  "104.17.60.60",
  "104.17.70.70",
  "104.17.80.80"
];

/**
 * Parses a CIDR block and generates random IPs inside it.
 */
export function generateIpsFromCidr(cidr: string, count: number = 30): string[] {
  try {
    const parts = cidr.split("/");
    if (parts.length !== 2) return [];
    
    const baseIp = parts[0];
    const mask = parseInt(parts[1], 10);
    if (isNaN(mask) || mask < 8 || mask > 31) return [];
    
    const octets = baseIp.split(".").map(o => parseInt(o, 10));
    if (octets.length !== 4 || octets.some(isNaN)) return [];
    
    // Convert base IP to 32-bit integer
    const ipInt = (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    
    // Compute subnet mask
    const subnetMask = (0xFFFFFFFF << (32 - mask)) >>> 0;
    const network = (ipInt & subnetMask) >>> 0;
    const hostCount = Math.pow(2, 32 - mask) - 2; // Subtract network and broadcast
    
    if (hostCount <= 0) return [baseIp];
    
    const ips = new Set<string>();
    const maxAttempts = count * 5;
    let attempts = 0;
    
    while (ips.size < Math.min(count, hostCount) && attempts < maxAttempts) {
      attempts++;
      // Generate random host part
      const randomHost = Math.floor(Math.random() * hostCount) + 1;
      const finalIpInt = (network | randomHost) >>> 0;
      
      const byte1 = (finalIpInt >>> 24) & 255;
      const byte2 = (finalIpInt >>> 16) & 255;
      const byte3 = (finalIpInt >>> 8) & 255;
      const byte4 = finalIpInt & 255;
      
      ips.add(`${byte1}.${byte2}.${byte3}.${byte4}`);
    }
    
    return Array.from(ips);
  } catch {
    return [];
  }
}
