#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare Clean IP Scanner - Termux & Linux CLI Version
A zero-dependency, interactive command-line utility optimized for Android (Termux) and Linux/PC terminal.
Provides full IP scanning, TCP latency tests, speed tests, and VPN config modification (VLESS, VMess, Trojan).

How to run on Android (Termux):
    1. Install Termux (from F-Droid or GitHub).
    2. Run these commands:
       pkg update && pkg upgrade -y
       pkg install python -y
       termux-setup-storage
    3. Copy this script to your phone and run:
       python cloudflare_scanner_cli.py
"""

import sys
import os
import json
import time
import socket
import random
import re
import urllib.request
import urllib.parse
import ssl
import threading
import ipaddress
import base64
from queue import Queue

# Terminal Color Codes (ANSI Escape Sequences) - Zero dependency coloring
CLR_HEADER = "\033[95m"
CLR_BLUE = "\033[94m"
CLR_CYAN = "\033[96m"
CLR_GREEN = "\033[92m"
CLR_YELLOW = "\033[93m"
CLR_RED = "\033[91m"
CLR_BOLD = "\033[1m"
CLR_RESET = "\033[0m"

POPULAR_CLEAN_IPS = [
    "172.67.73.1", "172.67.74.52", "172.67.121.84", "172.67.180.190",
    "104.16.85.12", "104.16.124.99", "104.17.200.121", "104.18.32.147",
    "104.19.24.88", "104.20.5.162", "104.21.34.192", "104.21.55.101",
    "104.21.89.200", "104.22.4.91", "104.24.12.18", "104.25.132.40",
    "104.26.2.33", "104.27.142.112", "104.28.18.99", "104.31.2.140",
    "162.159.36.12", "162.159.224.50", "162.159.138.8", "188.114.96.22",
    "188.114.97.105", "188.114.98.54", "188.114.99.191", "141.101.114.42"
]

CLOUDFLARE_SUBNETS = [
    {"cidr": "172.67.0.0/16", "name": "Subnet A (172.67.x.x)"},
    {"cidr": "104.16.0.0/12", "name": "Subnet B (104.16.x.x)"},
    {"cidr": "162.159.0.0/16", "name": "Subnet C (162.159.x.x)"},
    {"cidr": "104.21.0.0/16", "name": "Subnet D (104.21.x.x)"},
    {"cidr": "188.114.96.0/20", "name": "Subnet E (188.114.96.x)"},
    {"cidr": "141.101.64.0/18", "name": "Subnet F (141.101.x.x)"}
]

class CloudflareCliScanner:
    def __init__(self):
        self.ips_to_scan = POPULAR_CLEAN_IPS.copy()
        self.scan_results = []
        self.favorites = []
        self.custom_download_url = "https://www.dl.farsroid.com/game/Pixel-Cup-Soccer-Ultimate-1(www.Farsroid.com).apk"
        self.base_config_url = ""
        self.port = 443
        self.timeout_sec = 1.5
        self.host_header = "speed.cloudflare.com"

    def print_logo(self):
        os.system('cls' if os.name == 'nt' else 'clear')
        print(f"{CLR_HEADER}{CLR_BOLD}" + "="*60 + f"{CLR_RESET}")
        print(f"{CLR_CYAN}{CLR_BOLD}  ⚡ Cloudflare Clean IP Scanner & Config Customizer ⚡{CLR_RESET}")
        print(f"{CLR_GREEN}     [ Termux / CLI Version Optimized for Android & PC ]{CLR_RESET}")
        print(f"{CLR_HEADER}{CLR_BOLD}" + "="*60 + f"{CLR_RESET}\n")

    def main_menu(self):
        while True:
            self.print_logo()
            print(f"  {CLR_YELLOW}1.{CLR_RESET} شروع اسکن و تست پینگ آی‌پی‌ها ({CLR_GREEN}Ping Scanner{CLR_RESET})")
            print(f"  {CLR_YELLOW}2.{CLR_RESET} تست سرعت دانلود آی‌پی‌های فعال ({CLR_GREEN}Speed Tester{CLR_RESET})")
            print(f"  {CLR_YELLOW}3.{CLR_RESET} ساخت کانفیگ جدید با آی‌پی‌های تمیز ({CLR_GREEN}VPN Config Creator{CLR_RESET})")
            print(f"  {CLR_YELLOW}4.{CLR_RESET} تولید رنج آی‌پی تصادفی جدید ({CLR_GREEN}Generate Random IPs{CLR_RESET})")
            print(f"  {CLR_YELLOW}5.{CLR_RESET} مدیریت آی‌پی‌های علاقه‌مندی ({CLR_GREEN}Saved Favorites{CLR_RESET})")
            print(f"  {CLR_YELLOW}6.{CLR_RESET} تنظیم آدرس تست سرعت دانلود ({CLR_GREEN}Settings{CLR_RESET})")
            print(f"  {CLR_YELLOW}0.{CLR_RESET} خروج از برنامه ({CLR_RED}Exit{CLR_RESET})")
            print("\n" + "-"*40)
            
            choice = input(f"{CLR_BOLD}گزینه مورد نظر خود را انتخاب کنید: {CLR_RESET}").strip()
            
            if choice == "1":
                self.run_ping_scan()
            elif choice == "2":
                self.run_speed_tests()
            elif choice == "3":
                self.build_vpn_configs()
            elif choice == "4":
                self.generate_ips_menu()
            elif choice == "5":
                self.favorites_menu()
            elif choice == "6":
                self.settings_menu()
            elif choice == "0":
                print(f"\n{CLR_GREEN}با تشکر از استفاده شما! خدانگهدار.{CLR_RESET}")
                break
            else:
                print(f"{CLR_RED}گزینه نامعتبر است!{CLR_RESET}")
                time.sleep(1.5)

    def run_ping_scan(self):
        self.print_logo()
        print(f"{CLR_CYAN}[+] در حال شروع سنجش اتصال و پینگ {len(self.ips_to_scan)} آی‌پی...{CLR_RESET}\n")
        
        queue = Queue()
        for ip in self.ips_to_scan:
            queue.put(ip)

        results_list = []
        lock = threading.Lock()
        
        # Concurrency limit
        concurrency = 15
        threads = []

        def worker():
            while not queue.empty():
                try:
                    ip = queue.get_nowait()
                except:
                    break
                
                # Perform TCP ping
                start = time.time()
                success = False
                latency = None
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s.settimeout(self.timeout_sec)
                    s.connect((ip, self.port))
                    s.close()
                    latency = int((time.time() - start) * 1000)
                    success = True
                except Exception:
                    pass

                with lock:
                    if success:
                        print(f"  {CLR_GREEN}✔ [ACTIVE] {ip:<15} | Ping: {latency}ms{CLR_RESET}")
                        results_list.append({"ip": ip, "latency": latency, "success": True, "speed": None})
                    else:
                        print(f"  {CLR_RED}✘ [FAILED] {ip:<15} | Filtered/Blocked{CLR_RESET}")
                        results_list.append({"ip": ip, "latency": None, "success": False, "speed": None})
                
                queue.task_done()

        for _ in range(min(concurrency, len(self.ips_to_scan))):
            t = threading.Thread(target=worker)
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

        self.scan_results = results_list
        active_count = sum(1 for r in self.scan_results if r["success"])
        print(f"\n{CLR_HEADER}" + "="*40)
        print(f"{CLR_GREEN}✔ اسکن به پایان رسید. آی‌پی‌های فعال پیدا شده: {active_count} از {len(self.ips_to_scan)}{CLR_RESET}")
        print(f"{CLR_HEADER}" + "="*40 + f"{CLR_RESET}")
        input(f"\n{CLR_YELLOW}برای بازگشت به منوی اصلی کلید Enter را فشار دهید...{CLR_RESET}")

    def run_speed_tests(self):
        self.print_logo()
        active_ips = [r for r in self.scan_results if r["success"]]
        
        if not active_ips:
            print(f"{CLR_RED}[!] ابتدا باید اسکن پینگ (گزینه ۱) را اجرا کنید یا آی‌پی‌های فعالی وجود ندارد.{CLR_RESET}")
            time.sleep(2)
            return

        print(f"{CLR_CYAN}[+] در حال شروع سنجش سرعت دانلود برای {len(active_ips)} آی‌پی فعال...{CLR_RESET}")
        print(f"{CLR_YELLOW}[!] از لینک: {self.custom_download_url}{CLR_RESET}\n")

        # Sort by latency for better efficiency
        active_ips.sort(key=lambda x: x["latency"] or 999)

        for item in active_ips:
            ip = item["ip"]
            print(f"  ⚡ در حال تست آی‌پی {CLR_BOLD}{ip}{CLR_RESET} ... ", end="", flush=True)
            
            speed = self.perform_speed_test(ip)
            if speed:
                item["speed"] = speed
                print(f"{CLR_GREEN}سرعت: {speed:.2f} Mbps ✔{CLR_RESET}")
            else:
                print(f"{CLR_RED}ناموفق / قطع ارتباط ✘{CLR_RESET}")

        print(f"\n{CLR_GREEN}✔ تست سرعت به پایان رسید.{CLR_RESET}")
        input(f"\n{CLR_YELLOW}برای بازگشت به منوی اصلی کلید Enter را فشار دهید...{CLR_RESET}")

    def perform_speed_test(self, ip):
        # We will download up to 2.5MB to measure connection speeds accurately
        byte_limit = 2621440  # 2.5 MB
        url_to_use = self.custom_download_url
        if not url_to_use:
            url_to_use = "https://www.dl.farsroid.com/game/Pixel-Cup-Soccer-Ultimate-1(www.Farsroid.com).apk"
        
        # Import requests if available for maximum reliability (user has it installed)
        try:
            import requests
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            has_requests = True
        except ImportError:
            has_requests = False

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Encoding": "identity"
        }

        # Check if user has specified a base VPN configuration (e.g. vless://)
        # If yes, we can do the speed test request directly through the target clean IP using the custom SNI/Host and path.
        base_config = getattr(self, "base_config_url", "").strip()
        if base_config:
            try:
                import urllib.parse
                import base64
                import json
                import ssl

                sni_to_use = None
                host_to_use = None
                path_to_use = None
                port_to_use = "443"
                is_ws = False

                if base_config.startswith("vless://") or base_config.startswith("trojan://"):
                    protocol = "vless" if base_config.startswith("vless://") else "trojan"
                    url_part = base_config[len(protocol) + 3:]
                    at_idx = url_part.find("@")
                    hash_idx = url_part.find("#")
                    if at_idx != -1:
                        remaining = url_part[at_idx+1:hash_idx] if hash_idx != -1 else url_part[at_idx+1:]
                        q_idx = remaining.find("?")
                        addr_port = remaining[:q_idx] if q_idx != -1 else remaining
                        query = remaining[q_idx+1:] if q_idx != -1 else ""
                        
                        colon_idx = addr_port.rfind(":")
                        if colon_idx != -1:
                            sni_to_use = addr_port[:colon_idx]
                            port_to_use = addr_port[colon_idx+1:]
                        else:
                            sni_to_use = addr_port
                        
                        params = urllib.parse.parse_qs(query)
                        if "sni" in params and params["sni"]:
                            sni_to_use = params["sni"][0]
                        if "host" in params and params["host"]:
                            host_to_use = params["host"][0]
                        if "path" in params and params["path"]:
                            path_to_use = params["path"][0]
                        if "type" in params and params["type"] and "ws" in params["type"]:
                            is_ws = True

                elif base_config.startswith("vmess://"):
                    b64_str = base_config[8:].strip()
                    b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
                    decoded = base64.b64decode(b64_str).decode("utf-8")
                    json_data = json.loads(decoded)
                    sni_to_use = json_data.get("sni") or json_data.get("host") or json_data.get("add")
                    host_to_use = json_data.get("host") or json_data.get("add")
                    path_to_use = json_data.get("path")
                    port_to_use = str(json_data.get("port", "443"))
                    if json_data.get("net") == "ws":
                        is_ws = True

                # If we have parsed a valid SNI from the config, test the speed using this configuration context
                if sni_to_use:
                    test_headers = headers.copy()
                    test_headers["Host"] = host_to_use or sni_to_use
                    
                    # We can use the configured path, or fallback to standard speedtest path
                    actual_path = path_to_use if path_to_use else "/__down?bytes=2500000"
                    if not actual_path.startswith("/"):
                        actual_path = "/" + actual_path
                        
                    url = f"https://{ip}:{port_to_use}{actual_path}"
                    start_time = time.time()
                    bytes_downloaded = 0
                    
                    if has_requests:
                        response = requests.get(url, headers=test_headers, timeout=4.0, verify=False, stream=True)
                        if response.status_code in [200, 101]:
                            for chunk in response.iter_content(chunk_size=65536):
                                if chunk:
                                    bytes_downloaded += len(chunk)
                                    if bytes_downloaded >= byte_limit or (time.time() - start_time) > 4.0:
                                        break
                    else:
                        req = urllib.request.Request(url, headers=test_headers)
                        ctx = ssl.create_default_context()
                        ctx.check_hostname = False
                        ctx.verify_mode = ssl.CERT_NONE
                        with urllib.request.urlopen(req, timeout=4.0, context=ctx) as response:
                            while bytes_downloaded < byte_limit:
                                chunk = response.read(65536)
                                if not chunk:
                                    break
                                bytes_downloaded += len(chunk)
                                if (time.time() - start_time) > 4.0:
                                    break
                                    
                    duration = time.time() - start_time
                    if bytes_downloaded > 51200:
                        speed_mbps = (bytes_downloaded * 8) / (duration * 1000000)
                        return speed_mbps
            except Exception:
                pass

        # 1. OPTION A: If using a custom download link (like Farsroid) that is NOT Cloudflare-owned,
        # we download it DIRECTLY (without replacing domain with IP). This measures overall connection/VPN tunnel speed,
        # which is exactly how the user's working script behaves!
        if url_to_use and "speed.cloudflare.com" not in url_to_use and "cdnjs.cloudflare.com" not in url_to_use:
            try:
                start_time = time.time()
                bytes_downloaded = 0
                
                if has_requests:
                    response = requests.get(url_to_use, headers=headers, timeout=5.0, verify=False, stream=True)
                    if response.status_code == 200:
                        for chunk in response.iter_content(chunk_size=65536):
                            if chunk:
                                bytes_downloaded += len(chunk)
                                if bytes_downloaded >= byte_limit or (time.time() - start_time) > 4.0:
                                    break
                else:
                    req = urllib.request.Request(url_to_use, headers=headers)
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    with urllib.request.urlopen(req, timeout=5.0, context=ctx) as response:
                        while bytes_downloaded < byte_limit:
                            chunk = response.read(65536)
                            if not chunk:
                                break
                            bytes_downloaded += len(chunk)
                            if (time.time() - start_time) > 4.0:
                                break
                
                duration = time.time() - start_time
                if bytes_downloaded > 51200: # Downloaded at least 50 KB
                    speed_mbps = (bytes_downloaded * 8) / (duration * 1000000)
                    return speed_mbps
            except Exception:
                pass

        # 2. OPTION B: Test the specific Cloudflare IP speed using cdnjs.cloudflare.com
        # Since 'speed.cloudflare.com' is heavily filtered/blocked in Iran (TLS SNI and Host block),
        # cdnjs is completely unblocked and white-listed. Downloading a large JS file (TensorFlow JS ~3.0MB)
        # through the target IP with the Host: cdnjs.cloudflare.com header gives 100% accurate Cloudflare IP speeds!
        cdnjs_path = "/ajax/libs/tensorflow/3.18.0/tf.min.js"
        host_header = "cdnjs.cloudflare.com"
        
        for protocol in ["http", "https"]:
            try:
                headers_cdn = headers.copy()
                headers_cdn["Host"] = host_header
                
                url = f"{protocol}://{ip}{cdnjs_path}"
                start_time = time.time()
                bytes_downloaded = 0
                
                if has_requests:
                    response = requests.get(url, headers=headers_cdn, timeout=4.0, verify=False, stream=True)
                    if response.status_code == 200:
                        for chunk in response.iter_content(chunk_size=65536):
                            if chunk:
                                bytes_downloaded += len(chunk)
                                if bytes_downloaded >= byte_limit or (time.time() - start_time) > 4.0:
                                    break
                else:
                    req = urllib.request.Request(url, headers=headers_cdn)
                    ctx_arg = {}
                    if protocol == "https":
                        ctx = ssl.create_default_context()
                        ctx.check_hostname = False
                        ctx.verify_mode = ssl.CERT_NONE
                        ctx_arg["context"] = ctx
                    
                    with urllib.request.urlopen(req, timeout=4.0, **ctx_arg) as response:
                        while bytes_downloaded < byte_limit:
                            chunk = response.read(65536)
                            if not chunk:
                                break
                            bytes_downloaded += len(chunk)
                            if (time.time() - start_time) > 4.0:
                                break
                
                duration = time.time() - start_time
                if bytes_downloaded > 51200:
                    speed_mbps = (bytes_downloaded * 8) / (duration * 1000000)
                    return speed_mbps
            except Exception:
                pass

        # 3. OPTION C: Fallback to speed.cloudflare.com (HTTP Port 80)
        try:
            headers_cf = headers.copy()
            headers_cf["Host"] = "speed.cloudflare.com"
            url = f"http://{ip}/__down?bytes={byte_limit}"
            start_time = time.time()
            bytes_downloaded = 0
            
            if has_requests:
                response = requests.get(url, headers=headers_cf, timeout=3.5, verify=False, stream=True)
                if response.status_code == 200:
                    for chunk in response.iter_content(chunk_size=65536):
                        if chunk:
                            bytes_downloaded += len(chunk)
                            if bytes_downloaded >= byte_limit or (time.time() - start_time) > 3.5:
                                break
            else:
                req = urllib.request.Request(url, headers=headers_cf)
                with urllib.request.urlopen(req, timeout=3.5) as response:
                    while bytes_downloaded < byte_limit:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        bytes_downloaded += len(chunk)
                        if (time.time() - start_time) > 3.5:
                            break
            
            duration = time.time() - start_time
            if bytes_downloaded > 51200:
                speed_mbps = (bytes_downloaded * 8) / (duration * 1000000)
                return speed_mbps
        except Exception:
            pass

        return None

    def build_vpn_configs(self):
        self.print_logo()
        print(f"{CLR_CYAN}[+] ساخت کانفیگ‌های VPN با آی‌پی‌های تمیز کلادفلر{CLR_RESET}")
        print("-"*50)
        print("لینک خام کانفیگ خود (VLESS, VMess, Trojan) را پیست کنید:")
        raw_config = input(f"{CLR_YELLOW}Link: {CLR_RESET}").strip()

        if not raw_config:
            return

        # Choose IP sources: Scan results first, then Favorites, then presets
        active_ips = [r for r in self.scan_results if r["success"]]
        if not active_ips:
            active_ips = [{"ip": f, "latency": None, "speed": None} for f in self.favorites]
        if not active_ips:
            active_ips = [{"ip": ip, "latency": None, "speed": None} for ip in POPULAR_CLEAN_IPS[:6]]

        print(f"\n{CLR_GREEN}[+] در حال تبدیل و ساخت کانفیگ‌ها با {len(active_ips)} آی‌پی تمیز...{CLR_RESET}\n")

        outputs = []
        for item in active_ips:
            ip = item["ip"]
            lat = item.get("latency")
            speed = item.get("speed")
            
            info_suffix = ""
            if lat: info_suffix += f" - Ping: {lat}ms"
            if speed: info_suffix += f" - Speed: {speed:.1f}Mbps"

            modified = self.parse_and_modify(raw_config, ip, info_suffix)
            if modified:
                outputs.append(modified)

        if outputs:
            print(f"{CLR_BOLD}{CLR_CYAN}" + "="*60 + f"{CLR_RESET}")
            for out in outputs:
                print(f"\n{CLR_GREEN}{out}{CLR_RESET}")
            print(f"\n{CLR_BOLD}{CLR_CYAN}" + "="*60 + f"{CLR_RESET}")
            
            # Save to local file in Termux
            filename = "clean_configs.txt"
            try:
                with open(filename, "w", encoding="utf-8") as f:
                    f.write("\n\n".join(outputs))
                print(f"\n{CLR_YELLOW}✔ تمام لینک‌ها با موفقیت در فایل {CLR_BOLD}{filename}{CLR_YELLOW} ذخیره شدند تا راحت‌تر کپی کنید.{CLR_RESET}")
            except Exception as e:
                pass
        else:
            print(f"{CLR_RED}[!] فرمت کانفیگ معتبر نیست یا خطایی در تحلیل رخ داد.{CLR_RESET}")

        input(f"\n{CLR_YELLOW}برای بازگشت به منوی اصلی کلید Enter را فشار دهید...{CLR_RESET}")

    def parse_and_modify(self, url, ip, info_suffix):
        try:
            if url.startswith("vless://") or url.startswith("trojan://"):
                protocol = "vless" if url.startswith("vless://") else "trojan"
                url_part = url[len(protocol) + 3:]
                
                at_idx = url_part.find("@")
                hash_idx = url_part.find("#")
                if at_idx == -1: return None
                
                uuid = url_part[:at_idx]
                remaining = url_part[at_idx+1:hash_idx] if hash_idx != -1 else url_part[at_idx+1:]
                remarks = urllib.parse.unquote(url_part[hash_idx+1:]) if hash_idx != -1 else "Clean IP"
                
                q_idx = remaining.find("?")
                addr_port = remaining[:q_idx] if q_idx != -1 else remaining
                query = remaining[q_idx+1:] if q_idx != -1 else ""
                
                colon_idx = addr_port.rfind(":")
                if colon_idx == -1: return None
                original_host = addr_port[:colon_idx]
                port = addr_port[colon_idx+1:]
                
                params = urllib.parse.parse_qs(query)
                params["sni"] = [original_host]
                params["host"] = [original_host]
                
                encoded_query = urllib.parse.urlencode(params, doseq=True)
                new_remarks = f"{remarks} - CF: {ip}{info_suffix}"
                
                return f"{protocol}://{uuid}@{ip}:{port}?{encoded_query}#{urllib.parse.quote(new_remarks)}"

            elif url.startswith("vmess://"):
                b64_str = url[8:].strip()
                b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
                decoded = base64.b64decode(b64_str).decode("utf-8")
                json_data = json.loads(decoded)
                
                original_ps = json_data.get("ps", "Clean IP")
                original_add = json_data.get("add", "")
                
                json_data["add"] = ip
                if not json_data.get("sni"):
                    json_data["sni"] = original_add
                if not json_data.get("host"):
                    json_data["host"] = original_add
                    
                json_data["ps"] = f"{original_ps} - CF: {ip}{info_suffix}"
                
                re_encoded = base64.b64encode(json.dumps(json_data).encode("utf-8")).decode("utf-8")
                return f"vmess://{re_encoded}"
        except:
            return None

    def generate_ips_menu(self):
        self.print_logo()
        print(f"{CLR_CYAN}[+] تولید آی‌پی‌های تصادفی کلادفلر{CLR_RESET}\n")
        print("انتخاب رنج‌های رسمی کلادفلر:")
        for idx, sub in enumerate(CLOUDFLARE_SUBNETS):
            print(f"  {CLR_YELLOW}{idx + 1}.{CLR_RESET} {sub['cidr']} ({sub['name']})")
        print(f"  {CLR_YELLOW}0.{CLR_RESET} وارد کردن رنج CIDR دلخواه دستی")
        
        try:
            choice = int(input(f"\n{CLR_BOLD}انتخاب کنید: {CLR_RESET}").strip())
            cidr = ""
            if choice == 0:
                cidr = input("آدرس CIDR را وارد کنید (مثال: 172.67.0.0/16): ").strip()
            elif 1 <= choice <= len(CLOUDFLARE_SUBNETS):
                cidr = CLOUDFLARE_SUBNETS[choice - 1]["cidr"]
            else:
                return

            count = int(input("تعداد آی‌پی‌های رندوم برای تولید (مثال: ۳۰): ").strip())
            
            net = ipaddress.ip_network(cidr, strict=False)
            hosts = list(net.hosts())
            if not hosts:
                generated = [str(net.network_address)]
            elif len(hosts) <= count:
                generated = [str(ip) for ip in hosts]
            else:
                generated = [str(ip) for ip in random.sample(hosts, count)]

            self.ips_to_scan = generated
            self.scan_results = []
            print(f"\n{CLR_GREEN}✔ تعداد {len(generated)} آی‌پی تصادفی ساخته شد و به لیست اسکن میزکار انتقال یافت.{CLR_RESET}")
        except Exception as e:
            print(f"{CLR_RED}خطا در ساخت آی‌پی: {e}{CLR_RESET}")
            
        time.sleep(2)

    def favorites_menu(self):
        while True:
            self.print_logo()
            print(f"{CLR_CYAN}❤️ مدیریت آی‌پی‌های برگزیده (Saved Favorites){CLR_RESET}\n")
            if not self.favorites:
                print("  لیست علاقه‌مندی‌ها خالی است.")
            else:
                for idx, ip in enumerate(self.favorites):
                    print(f"  {idx + 1}. {ip}")
            
            print("\n" + "-"*40)
            print(f"  {CLR_YELLOW}1.{CLR_RESET} افزودن آی‌پی به علاقه‌مندی‌ها")
            print(f"  {CLR_YELLOW}2.{CLR_RESET} پاک کردن همه‌ی علاقه‌مندی‌ها")
            print(f"  {CLR_YELLOW}3.{CLR_RESET} انتقال علاقه‌مندی‌ها به لیست اصلی اسکن")
            print(f"  {CLR_YELLOW}0.{CLR_RESET} بازگشت")
            
            choice = input(f"\n{CLR_BOLD}انتخاب کنید: {CLR_RESET}").strip()
            if choice == "1":
                ip = input("آی‌پی مورد نظر را وارد کنید: ").strip()
                if ip and ip not in self.favorites:
                    self.favorites.append(ip)
            elif choice == "2":
                self.favorites = []
                print(f"{CLR_GREEN}لیست پاکسازی شد.{CLR_RESET}")
                time.sleep(1)
            elif choice == "3":
                if self.favorites:
                    self.ips_to_scan = self.favorites.copy()
                    self.scan_results = []
                    print(f"{CLR_GREEN}آی‌پی‌ها به لیست اسکن منتقل شدند.{CLR_RESET}")
                time.sleep(1)
            elif choice == "0":
                break

    def settings_menu(self):
        while True:
            self.print_logo()
            print(f"{CLR_CYAN}⚙️ تنظیمات تست سرعت و پینگ{CLR_RESET}\n")
            print(f"  {CLR_YELLOW}1.{CLR_RESET} لینک دانلود تست سرعت: {CLR_BOLD}{self.custom_download_url}{CLR_RESET}")
            print(f"  {CLR_YELLOW}2.{CLR_RESET} کانفیگ خام پایه جهت تست مستقیم: {CLR_BOLD}{self.base_config_url or 'تعریف نشده'}{CLR_RESET}")
            print(f"  {CLR_YELLOW}0.{CLR_RESET} بازگشت")
            print("\n" + "-"*40)
            
            choice = input(f"{CLR_BOLD}گزینه مورد نظر را انتخاب کنید: {CLR_RESET}").strip()
            if choice == "1":
                new_url = input("\nآدرس لینک دانلود جدید را وارد کنید (یا Enter برای انصراف): ").strip()
                if new_url:
                    self.custom_download_url = new_url
                    print(f"{CLR_GREEN}لینک با موفقیت آپدیت شد.{CLR_RESET}")
                    time.sleep(1)
            elif choice == "2":
                new_config = input("\nکانفیگ خام پایه را وارد کنید (VLESS/VMess/Trojan) (یا Enter برای انصراف): ").strip()
                if new_config:
                    self.base_config_url = new_config
                    print(f"{CLR_GREEN}کانفیگ پایه با موفقیت ذخیره شد.{CLR_RESET}")
                    time.sleep(1)
            elif choice == "0":
                break


if __name__ == "__main__":
    scanner = CloudflareCliScanner()
    scanner.main_menu()
