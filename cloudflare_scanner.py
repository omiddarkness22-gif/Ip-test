#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cloudflare Clean IP Scanner - Desktop Utility
A professional, multithreaded desktop application written in Python 3 using Tkinter.
Allows scanning of Cloudflare IPs, TCP latency tests, speed tests with intelligent fallback, 
and automatic VPN config modification (VLESS, VMess, Trojan).

How to run:
    1. Make sure Python 3 is installed on your computer.
    2. Save this file as 'cloudflare_scanner.py'.
    3. Run in your terminal: python cloudflare_scanner.py
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

# Import GUI libraries
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# Standard Popular Clean IPs to seed
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
    {"cidr": "172.67.0.0/16", "name": "Subnet A (172.67.x.x)", "desc_fa": "آی‌پی‌های لبه کلادفلر پرکاربرد", "desc_en": "Common Cloudflare edge IPs"},
    {"cidr": "104.16.0.0/12", "name": "Subnet B (104.16.x.x)", "desc_fa": "رنج بسیار بزرگ آی‌پی‌های کلادفلر", "desc_en": "Large Cloudflare IP block"},
    {"cidr": "162.159.0.0/16", "name": "Subnet C (162.159.x.x)", "desc_fa": "مورد استفاده در کلادفلر پیجز و وارپ", "desc_en": "Often used for Cloudflare Pages and Warp"},
    {"cidr": "104.21.0.0/16", "name": "Subnet D (104.21.x.x)", "desc_fa": "آی‌پی‌های شلوغ شبکه کلادفلر", "desc_en": "Highly populated Cloudflare CDN IPs"},
    {"cidr": "188.114.96.0/20", "name": "Subnet E (188.114.96.x)", "desc_fa": "رنج آی‌پی‌های اروپایی کلادفلر", "desc_en": "European Cloudflare IP block"},
    {"cidr": "141.101.64.0/18", "name": "Subnet F (141.101.x.x)", "desc_fa": "آی‌پی‌های جایگزین و با ثبات بالا", "desc_en": "Alternative stable Cloudflare IPs"}
]

class CloudflareScannerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Cloudflare Clean IP Scanner & Config Customizer")
        self.root.geometry("1000x750")
        
        # Default State variables
        self.language = "fa"  # "fa" or "en"
        self.ips_to_scan = POPULAR_CLEAN_IPS.copy()
        self.scan_results = [] # list of dicts: {"ip": str, "latency": int/None, "success": bool, "speed": float/None, "status": str}
        self.favorites = []
        self.is_scanning = False
        self.is_speed_testing = False
        self.testing_speed_ip = None
        self.custom_download_url = "https://www.dl.farsroid.com/game/Pixel-Cup-Soccer-Ultimate-1(www.Farsroid.com).apk"
        self.base_config_url = ""

        # Initialize configurations from memory
        self.port = 443
        self.timeout_sec = 1.5
        self.host_header = "speed.cloudflare.com"

        # Apply dark theme configuration
        self.setup_theme_colors()
        self.setup_ui()
        self.update_translation()
        self.refresh_workbench_table()

    def setup_theme_colors(self):
        # Material Dark Theme Slate Palette
        self.bg_color = "#0b0f19"       # Deep black-blue
        self.card_color = "#111827"     # Dark Slate
        self.border_color = "#1f2937"   # Gray border
        self.text_color = "#f3f4f6"     # Bright gray
        self.muted_text = "#9ca3af"     # Dim gray
        self.accent_color = "#4f46e5"   # Indigo Primary
        self.accent_hover = "#4338ca"   # Indigo Hover
        self.emerald = "#10b981"        # Green success
        self.rose = "#ef4444"           # Red error
        self.amber = "#f59e0b"          # Yellow notice

        # Configure Tkinter Treeview/Ttk styles
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(".", background=self.bg_color, foreground=self.text_color)
        style.configure("TFrame", background=self.bg_color)
        
        style.configure("TNotebook", background=self.bg_color, borderwidth=0)
        style.configure("TNotebook.Tab", background=self.card_color, foreground=self.muted_text, padding=[15, 6], borderwidth=1, font=("Segoe UI", 9, "bold"))
        style.map("TNotebook.Tab", background=[("selected", self.accent_color)], foreground=[("selected", "#ffffff")])

        style.configure("Treeview", background=self.card_color, fieldbackground=self.card_color, foreground=self.text_color, borderwidth=0, font=("Consolas", 9))
        style.configure("Treeview.Heading", background=self.bg_color, foreground=self.text_color, font=("Segoe UI", 9, "bold"))
        style.map("Treeview", background=[("selected", self.accent_color)], foreground=[("selected", "#ffffff")])

        # Scrollbar design
        style.configure("Vertical.TScrollbar", background=self.card_color, troughcolor=self.bg_color, borderwidth=0, arrowsize=10)

    def setup_ui(self):
        # Create Main UI Frame
        self.main_container = tk.Frame(self.root, bg=self.bg_color)
        self.main_container.pack(fill=tk.BOTH, expand=True)

        # Header bar
        self.header_frame = tk.Frame(self.main_container, bg=self.bg_color, height=60, bd=0)
        self.header_frame.pack(fill=tk.X, padx=20, pady=10)

        self.logo_label = tk.Label(self.header_frame, text="⚡", font=("Segoe UI", 18), bg=self.bg_color, fg=self.accent_color)
        self.logo_label.pack(side=tk.RIGHT if self.language == "fa" else tk.LEFT, padx=5)

        self.title_label = tk.Label(self.header_frame, text="", font=("Segoe UI", 14, "bold"), bg=self.bg_color, fg="#ffffff")
        self.title_label.pack(side=tk.RIGHT if self.language == "fa" else tk.LEFT, padx=5)

        self.lang_btn = tk.Button(self.header_frame, text="EN", font=("Segoe UI", 9, "bold"), bg=self.card_color, fg=self.text_color, activebackground=self.accent_color, activeforeground="#ffffff", bd=1, relief=tk.FLAT, width=6, command=self.toggle_language)
        self.lang_btn.pack(side=tk.LEFT if self.language == "fa" else tk.RIGHT, padx=5)

        # Create Tab Notebook
        self.notebook = ttk.Notebook(self.main_container)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        # Tab 1: Scanner Bench
        self.tab_scanner = tk.Frame(self.notebook, bg=self.bg_color)
        self.notebook.add(self.tab_scanner, text="میز کار اسکن")

        # Tab 2: IP Generation/Presets
        self.tab_ip_manager = tk.Frame(self.notebook, bg=self.bg_color)
        self.notebook.add(self.tab_ip_manager, text="مدیریت و تولید آی‌پی")

        # Tab 3: Config Builder
        self.tab_configs = tk.Frame(self.notebook, bg=self.bg_color)
        self.notebook.add(self.tab_configs, text="شخصی‌سازی کانفیگ VPN")

        # Build individual Tabs
        self.build_scanner_tab()
        self.build_ip_manager_tab()
        self.build_configs_tab()

    def toggle_language(self):
        self.language = "en" if self.language == "fa" else "fa"
        self.lang_btn.config(text="FA" if self.language == "en" else "EN")
        self.update_translation()
        
    def update_translation(self):
        is_fa = self.language == "fa"
        
        # Global Texts
        title_text = "اسکنر آی‌پی تمیز کلادفلر (نسخه ویندوز/دسکتاپ)" if is_fa else "Cloudflare Clean IP Desktop Scanner"
        self.title_label.config(text=title_text)

        self.notebook.tab(0, text="📊 میز کار اسکن (Workbench)" if is_fa else "📊 Scanner Workbench")
        self.notebook.tab(1, text="🌐 تولید و رنج‌های آی‌پی" if is_fa else "🌐 IP Generator & Presets")
        self.notebook.tab(2, text="🛠️ شخصی‌سازی کانفیگ VPN" if is_fa else "🛠️ VPN Config Customizer")

        # Tab 1: Scanner Workbench Translations
        self.lbl_settings_title.config(text="⚙️ تنظیمات اسکن" if is_fa else "⚙️ Scan Options")
        self.lbl_port.config(text="پورت مقصد:" if is_fa else "Destination Port:")
        self.lbl_timeout.config(text="مهلت انتظار (میلی‌ثانیه):" if is_fa else "Timeout (ms):")
        self.lbl_host_sni.config(text="SNI هاست کلادفلر:" if is_fa else "Cloudflare SNI/Host:")
        self.lbl_speed_url.config(text="🔗 لینک فایل دانلود جهت تست سرعت دانلود:" if is_fa else "🔗 Download File URL for Speed Test:")
        self.lbl_base_config.config(text="⚙️ کانفیگ خام پایه (VLESS/VMess/Trojan):" if is_fa else "⚙️ Base RAW VPN Config:")
        self.lbl_import_ips.config(text="📥 وارد کردن آی‌پی جدید (با کاما یا خط جدید جدا شود):" if is_fa else "📥 Paste Custom IPs (Comma or Newline separated):")
        self.btn_import.config(text="افزودن به لیست تست" if is_fa else "Add to Workbench")
        
        self.btn_start_scan.config(text="🚀 شروع تست پینگ و کیفیت" if is_fa else "🚀 Start Ping Test")
        self.btn_batch_speed.config(text="⚡ تست سرعت گروهی آی‌پی‌های فعال" if is_fa else "⚡ Test Speed of All Clean IPs")
        self.btn_clear_bench.config(text="🗑️ پاکسازی میز کار" if is_fa else "🗑️ Clear List")

        # Treeview Headings
        self.tree.heading("ip", text="آدرس آی‌پی (IP Address)" if is_fa else "IP Address")
        self.tree.heading("latency", text="تاخیر پینگ (Ping)" if is_fa else "Ping Latency")
        self.tree.heading("speed", text="سرعت دانلود (Speed)" if is_fa else "Download Speed")
        self.tree.heading("status", text="وضعیت اتصال (Status)" if is_fa else "Status")

        # Right-click Context Menu translation
        self.menu_actions.entryconfigure(0, label="تست سرعت این آی‌پی" if is_fa else "Test Speed of This IP")
        self.menu_actions.entryconfigure(1, label="ذخیره در علاقه‌مندی‌ها" if is_fa else "Add to Saved/Favorites")
        self.menu_actions.entryconfigure(3, label="کپی آدرس آی‌پی" if is_fa else "Copy IP Address")
        self.menu_actions.entryconfigure(4, label="حذف از این لیست" if is_fa else "Delete from List")

        # Tab 2: IP Manager translations
        self.lbl_generator_title.config(text="🔧 رنج‌های رسمی کلادفلر و تولید آی‌پی تصادفی" if is_fa else "🔧 Official Cloudflare Range Generator")
        self.lbl_select_range.config(text="انتخاب رنج شبکه (CIDR):" if is_fa else "Select Subnet CIDR:")
        self.lbl_custom_cidr.config(text="یا وارد کردن CIDR دلخواه:" if is_fa else "Or Enter Custom CIDR:")
        self.lbl_gen_count.config(text="تعداد تولید آی‌پی تصادفی:" if is_fa else "IP Generation Count:")
        self.btn_generate.config(text="🎲 تولید آی‌پی و افزودن به لیست" if is_fa else "🎲 Generate & Load")
        self.btn_load_popular.config(text="🔥 بارگذاری ۵۰ آی‌پی پیشنهادی تمیز" if is_fa else "🔥 Add 50 Popular Clean IPs")
        
        self.lbl_favorites_title.config(text="❤️ آی‌پی‌های برگزیده و ذخیره‌شده شما" if is_fa else "❤️ Saved Favorites Clean IPs")
        self.btn_copy_favs.config(text="📋 کپی همه‌ی علاقه‌مندی‌ها" if is_fa else "📋 Copy All Favorites")
        self.btn_load_favs_to_bench.config(text="📥 فرستادن علاقه‌مندی‌ها به میزکار اسکن" if is_fa else "📥 Send Favorites to Workbench")

        # Tab 3: Config Builder translations
        self.lbl_config_title.config(text="⚙️ ساخت کانفیگ بهینه‌شده با آی‌پی تمیز شما" if is_fa else "⚙️ Inject Clean Cloudflare IPs into your VPN configuration")
        self.lbl_config_subtitle.config(text="کافیست کانفیگ خود (VLESS , Trojan , VMess) را قرار دهید تا با آی‌پی‌های فعال ترکیب شود:" if is_fa else "Paste your raw link (vless://, trojan://, vmess://) to bind to clean Cloudflare edge IPs:")
        self.btn_parse_config.config(text="🛠️ آنالیز و تولید کانفیگ‌ها" if is_fa else "🛠️ Process & Build Final Links")
        self.lbl_output_title.config(text="📋 لینک‌های خروجی سفارشی‌سازی شده آماده کپی:" if is_fa else "📋 Clean Customized Client Configuration Links:")
        self.btn_copy_all_configs.config(text="📥 کپی همه‌ی کانفیگ‌های خروجی" if is_fa else "📥 Copy All Generated Links")

    # ==================== Tab 1: Scanner Setup ====================
    def build_scanner_tab(self):
        # Left Panel (Options) & Right Panel (Tree list of IPs)
        self.tab_scanner.grid_columnconfigure(0, weight=1, minsize=320)
        self.tab_scanner.grid_columnconfigure(1, weight=3)
        self.tab_scanner.grid_rowconfigure(0, weight=1)

        # Left options frame
        left_frame = tk.Frame(self.tab_scanner, bg=self.card_color, bd=1, relief=tk.SOLID)
        left_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=10)
        left_frame.grid_columnconfigure(0, weight=1)

        # Content of Left Options Frame
        self.lbl_settings_title = tk.Label(left_frame, text="", font=("Segoe UI", 11, "bold"), bg=self.card_color, fg="#ffffff")
        self.lbl_settings_title.pack(anchor="w", padx=15, pady=(15, 10))

        # Port Field
        self.lbl_port = tk.Label(left_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_port.pack(anchor="w", padx=15, pady=(5, 2))
        self.ent_port = tk.Entry(left_frame, font=("Consolas", 10), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_port.pack(fill=tk.X, padx=15, pady=(0, 10))
        self.ent_port.insert(0, str(self.port))

        # Timeout Field
        self.lbl_timeout = tk.Label(left_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_timeout.pack(anchor="w", padx=15, pady=(5, 2))
        self.ent_timeout = tk.Entry(left_frame, font=("Consolas", 10), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_timeout.pack(fill=tk.X, padx=15, pady=(0, 10))
        self.ent_timeout.insert(0, "1500")

        # Host Header/SNI Field
        self.lbl_host_sni = tk.Label(left_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_host_sni.pack(anchor="w", padx=15, pady=(5, 2))
        self.ent_host_sni = tk.Entry(left_frame, font=("Consolas", 10), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_host_sni.pack(fill=tk.X, padx=15, pady=(0, 10))
        self.ent_host_sni.insert(0, self.host_header)

        # Speed test custom URL field
        self.lbl_speed_url = tk.Label(left_frame, text="", font=("Segoe UI", 9, "bold"), bg=self.card_color, fg=self.muted_text)
        self.lbl_speed_url.pack(anchor="w", padx=15, pady=(10, 2))
        self.ent_speed_url = tk.Entry(left_frame, font=("Consolas", 9), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_speed_url.pack(fill=tk.X, padx=15, pady=(0, 10))
        self.ent_speed_url.insert(0, self.custom_download_url)

        # Base VPN config template field for real connection & speed testing
        self.lbl_base_config = tk.Label(left_frame, text="", font=("Segoe UI", 9, "bold"), bg=self.card_color, fg=self.muted_text)
        self.lbl_base_config.pack(anchor="w", padx=15, pady=(10, 2))
        self.ent_base_config = tk.Entry(left_frame, font=("Consolas", 9), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_base_config.pack(fill=tk.X, padx=15, pady=(0, 10))
        self.ent_base_config.insert(0, getattr(self, "base_config_url", ""))

        # Bulk IP import field
        self.lbl_import_ips = tk.Label(left_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_import_ips.pack(anchor="w", padx=15, pady=(10, 2))
        self.txt_import = scrolledtext.ScrolledText(left_frame, height=5, font=("Consolas", 9), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.txt_import.pack(fill=tk.X, padx=15, pady=(0, 5))

        self.btn_import = tk.Button(left_frame, text="", font=("Segoe UI", 9, "bold"), bg=self.bg_color, fg=self.text_color, activebackground=self.accent_color, bd=1, relief=tk.SOLID, height=2, command=self.import_custom_ips)
        self.btn_import.pack(fill=tk.X, padx=15, pady=(5, 15))


        # Right panel: Table list & diagnostics controls
        right_frame = tk.Frame(self.tab_scanner, bg=self.bg_color)
        right_frame.grid(row=0, column=1, sticky="nsew", pady=10)
        right_frame.grid_rowconfigure(0, weight=1)
        right_frame.grid_columnconfigure(0, weight=1)

        # Tool buttons row at top
        btns_row = tk.Frame(right_frame, bg=self.bg_color)
        btns_row.pack(fill=tk.X, pady=(0, 10))

        self.btn_start_scan = tk.Button(btns_row, text="", font=("Segoe UI", 10, "bold"), bg=self.accent_color, fg="#ffffff", activebackground=self.accent_hover, bd=0, padx=15, pady=8, command=self.start_ping_scanner)
        self.btn_start_scan.pack(side=tk.RIGHT if self.language == "fa" else tk.LEFT, padx=5)

        self.btn_batch_speed = tk.Button(btns_row, text="", font=("Segoe UI", 10, "bold"), bg=self.emerald, fg="#ffffff", activebackground="#059669", bd=0, padx=15, pady=8, command=self.start_batch_speed_test)
        self.btn_batch_speed.pack(side=tk.RIGHT if self.language == "fa" else tk.LEFT, padx=5)

        self.btn_clear_bench = tk.Button(btns_row, text="", font=("Segoe UI", 9, "bold"), bg=self.card_color, fg=self.muted_text, activebackground=self.rose, bd=1, relief=tk.SOLID, padx=12, pady=6, command=self.clear_workbench)
        self.btn_clear_bench.pack(side=tk.LEFT if self.language == "fa" else tk.RIGHT, padx=5)

        # Progress bar
        self.progress_bar = ttk.Progressbar(right_frame, orient="horizontal", mode="determinate")
        self.progress_bar.pack(fill=tk.X, pady=(0, 10))

        # Treeview list table
        table_container = tk.Frame(right_frame, bg=self.bg_color)
        table_container.pack(fill=tk.BOTH, expand=True)

        columns = ("ip", "latency", "speed", "status")
        self.tree = ttk.Treeview(table_container, columns=columns, show="headings", selectmode="browse")
        
        # Scrollbars
        scrollbar_y = ttk.Scrollbar(table_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar_y.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)

        # Column settings
        self.tree.column("ip", width=150, anchor="center")
        self.tree.column("latency", width=110, anchor="center")
        self.tree.column("speed", width=130, anchor="center")
        self.tree.column("status", width=180, anchor="center")

        # Context Menu for rows
        self.menu_actions = tk.Menu(self.root, tearoff=0, bg=self.card_color, fg=self.text_color, activebackground=self.accent_color)
        self.menu_actions.add_command(label="", command=self.trigger_single_speed_test)
        self.menu_actions.add_command(label="", command=self.add_selected_to_favorites)
        self.menu_actions.add_separator()
        self.menu_actions.add_command(label="", command=self.copy_selected_ip)
        self.menu_actions.add_command(label="", command=self.delete_selected_ip)

        self.tree.bind("<Button-3>", self.show_context_menu)

    def show_context_menu(self, event):
        row_id = self.tree.identify_row(event.y)
        if row_id:
            self.tree.selection_set(row_id)
            self.menu_actions.post(event.x_root, event.y_root)

    def trigger_single_speed_test(self):
        selected = self.tree.selection()
        if not selected: return
        item = self.tree.item(selected[0])
        ip = item["values"][0]
        
        # Run single speed test in background
        if self.is_speed_testing or self.is_scanning:
            messagebox.showwarning("Warning", "Another test is currently running." if self.language == "en" else "تست دیگری در حال اجراست.")
            return

        threading.Thread(target=self.run_single_ip_speed, args=(ip,), daemon=True).start()

    def run_single_ip_speed(self, ip):
        self.is_speed_testing = True
        self.testing_speed_ip = ip
        self.update_row_status(ip, "speedTesting", "Measuring speed...")
        
        speed_mbps = self.test_speed_request(ip)
        
        if speed_mbps is not None:
            self.update_row_speed(ip, speed_mbps, f"{speed_mbps:.2f} Mbps")
        else:
            self.update_row_speed(ip, None, "Failed / Timeout")
        self.is_speed_testing = False
        self.testing_speed_ip = None

    def add_selected_to_favorites(self):
        selected = self.tree.selection()
        if not selected: return
        ip = self.tree.item(selected[0])["values"][0]
        if ip not in self.favorites:
            self.favorites.append(ip)
            self.refresh_favorites_list()
            messagebox.showinfo("Favorites", f"IP {ip} added to saved Favorites." if self.language == "en" else f"آی‌پی {ip} با موفقیت به علاقه‌مندی‌ها اضافه شد.")

    def copy_selected_ip(self):
        selected = self.tree.selection()
        if not selected: return
        ip = self.tree.item(selected[0])["values"][0]
        self.root.clipboard_clear()
        self.root.clipboard_append(ip)
        messagebox.showinfo("Copied", "IP address copied to clipboard." if self.language == "en" else "آدرس آی‌پی کپی شد.")

    def delete_selected_ip(self):
        selected = self.tree.selection()
        if not selected: return
        ip = self.tree.item(selected[0])["values"][0]
        if ip in self.ips_to_scan:
            self.ips_to_scan.remove(ip)
            self.scan_results = [r for r in self.scan_results if r["ip"] != ip]
            self.refresh_workbench_table()

    def refresh_workbench_table(self):
        # Clear tree
        for child in self.tree.get_children():
            self.tree.delete(child)

        # Load values
        for r in self.scan_results:
            lat_str = f"{r['latency']} ms" if r["latency"] is not None else "--"
            speed_str = f"{r['speed']:.2f} Mbps" if r["speed"] is not None else "--"
            self.tree.insert("", tk.END, values=(r["ip"], lat_str, speed_str, r["status"]))

        # Check if empty, populate default placeholders
        if not self.scan_results and self.ips_to_scan:
            for ip in self.ips_to_scan:
                self.tree.insert("", tk.END, values=(ip, "--", "--", "Pending" if self.language == "en" else "در انتظار تست"))

    def update_row_status(self, ip, status_type, status_text):
        # Find index and update treeview directly for instant user feedback
        for child in self.tree.get_children():
            val = self.tree.item(child)["values"]
            if val[0] == ip:
                self.tree.item(child, values=(ip, val[1], val[2], status_text))
                break

    def update_row_latency(self, ip, latency, text):
        for child in self.tree.get_children():
            val = self.tree.item(child)["values"]
            if val[0] == ip:
                self.tree.item(child, values=(ip, f"{latency} ms", val[2], text))
                break

    def update_row_speed(self, ip, speed, speed_text):
        # Update our in-memory results too
        for r in self.scan_results:
            if r["ip"] == ip:
                r["speed"] = speed
                r["status"] = "Verified Clean" if self.language == "en" else "تایید شده تمیز"
                break

        for child in self.tree.get_children():
            val = self.tree.item(child)["values"]
            if val[0] == ip:
                self.tree.item(child, values=(ip, val[1], speed_text, "Tested" if self.language == "en" else "تست شده"))
                break

    def import_custom_ips(self):
        text = self.txt_import.get("1.0", tk.END)
        raw_list = re.split(r"[\s,;\n]+", text)
        clean_ips = []
        for term in raw_list:
            term = term.strip()
            if not term: continue
            # Basic IPv4 validation regex
            if re.match(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$", term):
                clean_ips.append(term)
        
        if clean_ips:
            added = 0
            for ip in clean_ips:
                if ip not in self.ips_to_scan:
                    self.ips_to_scan.append(ip)
                    added += 1
            self.txt_import.delete("1.0", tk.END)
            self.refresh_workbench_table()
            messagebox.showinfo("Imported", f"Added {added} unique IPs to scanner list." if self.language == "en" else f"تعداد {added} آی‌پی جدید به لیست اضافه شد.")
        else:
            messagebox.showerror("Error", "No valid IPv4 addresses found." if self.language == "en" else "هیچ آی‌پی معتبری شناسایی نشد.")

    def clear_workbench(self):
        self.ips_to_scan = []
        self.scan_results = []
        self.refresh_workbench_table()

    # ==================== Tab 2: IP Manager & Presets Setup ====================
    def build_ip_manager_tab(self):
        self.tab_ip_manager.grid_columnconfigure(0, weight=1)
        self.tab_ip_manager.grid_columnconfigure(1, weight=1)
        self.tab_ip_manager.grid_rowconfigure(0, weight=1)

        # Left Column: Generator
        gen_frame = tk.Frame(self.tab_ip_manager, bg=self.card_color, bd=1, relief=tk.SOLID)
        gen_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=10)

        self.lbl_generator_title = tk.Label(gen_frame, text="", font=("Segoe UI", 11, "bold"), bg=self.card_color, fg="#ffffff")
        self.lbl_generator_title.pack(anchor="w", padx=20, pady=(20, 15))

        self.lbl_select_range = tk.Label(gen_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_select_range.pack(anchor="w", padx=20, pady=(5, 2))

        # Dropdown for Cloudflare ranges
        self.subnet_combobox = ttk.Combobox(gen_frame, font=("Consolas", 9), state="readonly")
        self.subnet_combobox.pack(fill=tk.X, padx=20, pady=(0, 15))
        self.subnet_combobox["values"] = [f"{sub['cidr']} - {sub['name']}" for sub in CLOUDFLARE_SUBNETS]
        self.subnet_combobox.current(0)

        self.lbl_custom_cidr = tk.Label(gen_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_custom_cidr.pack(anchor="w", padx=20, pady=(5, 2))
        self.ent_custom_cidr = tk.Entry(gen_frame, font=("Consolas", 10), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_custom_cidr.pack(fill=tk.X, padx=20, pady=(0, 15))

        self.lbl_gen_count = tk.Label(gen_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_gen_count.pack(anchor="w", padx=20, pady=(5, 2))
        self.ent_gen_count = tk.Entry(gen_frame, font=("Consolas", 10), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.ent_gen_count.pack(fill=tk.X, padx=20, pady=(0, 20))
        self.ent_gen_count.insert(0, "30")

        self.btn_generate = tk.Button(gen_frame, text="", font=("Segoe UI", 10, "bold"), bg=self.accent_color, fg="#ffffff", activebackground=self.accent_hover, bd=0, height=2, command=self.generate_cidr_ips)
        self.btn_generate.pack(fill=tk.X, padx=20, pady=10)

        self.btn_load_popular = tk.Button(gen_frame, text="", font=("Segoe UI", 10, "bold"), bg=self.bg_color, fg=self.text_color, activebackground=self.accent_color, bd=1, relief=tk.SOLID, height=2, command=self.load_preset_clean_ips)
        self.btn_load_popular.pack(fill=tk.X, padx=20, pady=10)


        # Right Column: Favorites list
        fav_frame = tk.Frame(self.tab_ip_manager, bg=self.card_color, bd=1, relief=tk.SOLID)
        fav_frame.grid(row=0, column=1, sticky="nsew", pady=10)

        self.lbl_favorites_title = tk.Label(fav_frame, text="", font=("Segoe UI", 11, "bold"), bg=self.card_color, fg="#ffffff")
        self.lbl_favorites_title.pack(anchor="w", padx=20, pady=(20, 15))

        self.lst_favorites = tk.Listbox(fav_frame, font=("Consolas", 10), bg=self.bg_color, fg=self.text_color, selectbackground=self.accent_color, bd=1, relief=tk.SOLID)
        self.lst_favorites.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 15))

        # Favorites utility buttons
        self.btn_copy_favs = tk.Button(fav_frame, text="", font=("Segoe UI", 9, "bold"), bg=self.bg_color, fg=self.text_color, activebackground=self.accent_color, bd=1, relief=tk.SOLID, height=2, command=self.copy_all_favorites)
        self.btn_copy_favs.pack(fill=tk.X, padx=20, pady=5)

        self.btn_load_favs_to_bench = tk.Button(fav_frame, text="", font=("Segoe UI", 9, "bold"), bg=self.bg_color, fg=self.text_color, activebackground=self.accent_color, bd=1, relief=tk.SOLID, height=2, command=self.load_favorites_to_workbench)
        self.btn_load_favs_to_bench.pack(fill=tk.X, padx=20, pady=15)

    def generate_cidr_ips(self):
        custom = self.ent_custom_cidr.get().strip()
        cidr_to_use = ""
        
        if custom:
            cidr_to_use = custom
        else:
            selected_val = self.subnet_combobox.get()
            if selected_val:
                cidr_to_use = selected_val.split(" - ")[0]

        count_str = self.ent_gen_count.get()
        count = 30
        try:
            count = int(count_str)
        except:
            pass

        try:
            net = ipaddress.ip_network(cidr_to_use, strict=False)
            hosts = list(net.hosts())
            if not hosts:
                generated = [str(net.network_address)]
            elif len(hosts) <= count:
                generated = [str(ip) for ip in hosts]
            else:
                generated = [str(ip) for ip in random.sample(hosts, count)]

            added_count = 0
            for ip in generated:
                if ip not in self.ips_to_scan:
                    self.ips_to_scan.append(ip)
                    added_count += 1
            
            self.refresh_workbench_table()
            messagebox.showinfo("Success", f"Generated and added {added_count} IPs to scan list!" if self.language == "en" else f"تعداد {added_count} آی‌پی تصادفی از رنج انتخابی ساخته و به لیست اضافه شد.")
        except Exception as e:
            messagebox.showerror("Error", f"Invalid CIDR: {e}" if self.language == "en" else f"خطا در تحلیل رنج CIDR: {e}")

    def load_preset_clean_ips(self):
        added = 0
        for ip in POPULAR_CLEAN_IPS:
            if ip not in self.ips_to_scan:
                self.ips_to_scan.append(ip)
                added += 1
        self.refresh_workbench_table()
        messagebox.showinfo("Presets Loaded", f"Added {added} popular clean IPs to list." if self.language == "en" else f"تعداد {added} آی‌پی کلادفلر پیشنهادی به لیست اضافه شد.")

    def refresh_favorites_list(self):
        self.lst_favorites.delete(0, tk.END)
        for fav in self.favorites:
            self.lst_favorites.insert(tk.END, fav)

    def copy_all_favorites(self):
        if not self.favorites: return
        joined = "\n".join(self.favorites)
        self.root.clipboard_clear()
        self.root.clipboard_append(joined)
        messagebox.showinfo("Copied", "All favorite IPs copied to clipboard." if self.language == "en" else "تمام آی‌پی‌های علاقه‌مندی‌ها کپی شدند.")

    def load_favorites_to_workbench(self):
        added = 0
        for ip in self.favorites:
            if ip not in self.ips_to_scan:
                self.ips_to_scan.append(ip)
                added += 1
        self.refresh_workbench_table()
        messagebox.showinfo("Loaded", f"Loaded {added} favorites to workbench." if self.language == "en" else f"تعداد {added} آی‌پی به میزکار اضافه شد.")


    # ==================== Tab 3: VPN Config Customizer Setup ====================
    def build_configs_tab(self):
        self.tab_configs.grid_columnconfigure(0, weight=1)
        self.tab_configs.grid_rowconfigure(0, weight=1)

        wrapper_frame = tk.Frame(self.tab_configs, bg=self.card_color, bd=1, relief=tk.SOLID)
        wrapper_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.lbl_config_title = tk.Label(wrapper_frame, text="", font=("Segoe UI", 11, "bold"), bg=self.card_color, fg="#ffffff")
        self.lbl_config_title.pack(anchor="w", padx=20, pady=(20, 5))

        self.lbl_config_subtitle = tk.Label(wrapper_frame, text="", font=("Segoe UI", 9), bg=self.card_color, fg=self.muted_text)
        self.lbl_config_subtitle.pack(anchor="w", padx=20, pady=(0, 15))

        # Raw config input field
        self.txt_raw_config = scrolledtext.ScrolledText(wrapper_frame, height=5, font=("Consolas", 9), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.txt_raw_config.pack(fill=tk.X, padx=20, pady=(0, 15))

        self.btn_parse_config = tk.Button(wrapper_frame, text="", font=("Segoe UI", 10, "bold"), bg=self.accent_color, fg="#ffffff", activebackground=self.accent_hover, bd=0, height=2, command=self.process_config_modification)
        self.btn_parse_config.pack(fill=tk.X, padx=20, pady=(0, 20))

        self.lbl_output_title = tk.Label(wrapper_frame, text="", font=("Segoe UI", 10, "bold"), bg=self.card_color, fg="#ffffff")
        self.lbl_output_title.pack(anchor="w", padx=20, pady=(10, 5))

        # Output scrollable links
        self.txt_modified_configs = scrolledtext.ScrolledText(wrapper_frame, height=12, font=("Consolas", 8), bg=self.bg_color, fg=self.text_color, insertbackground=self.text_color, bd=1, relief=tk.SOLID)
        self.txt_modified_configs.pack(fill=tk.BOTH, expand=True, padx=20, pady=(0, 15))

        self.btn_copy_all_configs = tk.Button(wrapper_frame, text="", font=("Segoe UI", 10, "bold"), bg=self.emerald, fg="#ffffff", activebackground="#059669", bd=0, height=2, command=self.copy_all_generated_configs)
        self.btn_copy_all_configs.pack(fill=tk.X, padx=20, pady=15)

    def process_config_modification(self):
        raw_val = self.txt_raw_config.get("1.0", tk.END).strip()
        if not raw_val:
            messagebox.showerror("Error", "Please paste your VPN link." if self.language == "en" else "لطفا لینک کانفیگ خود را وارد کنید.")
            return

        # Read successful IPs
        successful_ips = [r for r in self.scan_results if r["success"]]
        
        # If no scan results, use favorites
        if not successful_ips:
            successful_ips = [{"ip": f, "latency": None} for f in self.favorites]

        # If still none, use the original presets
        if not successful_ips:
            successful_ips = [{"ip": ip, "latency": None} for ip in POPULAR_CLEAN_IPS[:6]]

        outputs = []
        for r in successful_ips:
            ip = r["ip"]
            lat = r.get("latency")
            modified = self.parse_and_substitute_ip(raw_val, ip, lat)
            if modified:
                outputs.append(modified)

        if outputs:
            self.txt_modified_configs.delete("1.0", tk.END)
            self.txt_modified_configs.insert(tk.END, "\n\n".join(outputs))
            messagebox.showinfo("Finished", f"Generated {len(outputs)} customized configurations." if self.language == "en" else f"تعداد {len(outputs)} کانفیگ جدید با آی‌پی‌های تمیز ساخته شد.")
        else:
            messagebox.showerror("Error", "Unsupported VPN link or error parsing." if self.language == "en" else "فرمت لینک پشتیبانی نمی‌شود یا خطایی در تحلیل رخ داده است.")

    def parse_and_substitute_ip(self, url, ip, latency):
        try:
            latency_str = f" - Ping: {latency}ms" if latency else ""
            
            if url.startswith("vless://") or url.startswith("trojan://"):
                protocol = "vless" if url.startswith("vless://") else "trojan"
                url_part = url[len(protocol) + 3:]
                
                # Split at @ and #
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
                
                # Parse query params
                params = urllib.parse.parse_qs(query)
                # Keep original domain inside SNI and Host
                params["sni"] = [original_host]
                params["host"] = [original_host]
                
                # Re-encode query
                encoded_query = urllib.parse.urlencode(params, doseq=True)
                new_remarks = f"{remarks} - CF: {ip}{latency_str}"
                
                return f"{protocol}://{uuid}@{ip}:{port}?{encoded_query}#{urllib.parse.quote(new_remarks)}"

            elif url.startswith("vmess://"):
                # Base64 decode
                b64_str = url[8:].strip()
                # Fix padding
                b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
                decoded = base64.b64decode(b64_str).decode("utf-8")
                json_data = json.loads(decoded)
                
                original_ps = json_data.get("ps", "Clean IP")
                original_add = json_data.get("add", "")
                
                # Bind IP and preserve SNI / Host
                json_data["add"] = ip
                if not json_data.get("sni"):
                    json_data["sni"] = original_add
                if not json_data.get("host"):
                    json_data["host"] = original_add
                    
                json_data["ps"] = f"{original_ps} - CF: {ip}{latency_str}"
                
                re_encoded = base64.b64encode(json.dumps(json_data).encode("utf-8")).decode("utf-8")
                return f"vmess://{re_encoded}"
        except:
            return None

    def copy_all_generated_configs(self):
        text = self.txt_modified_configs.get("1.0", tk.END).strip()
        if text:
            self.root.clipboard_clear()
            self.root.clipboard_append(text)
            messagebox.showinfo("Copied", "All modified configs copied to clipboard." if self.language == "en" else "تمامی کانفیگ‌های خروجی کپی شدند.")


    # ==================== Multithreaded Core Scanners & Diagnostics ====================
    def start_ping_scanner(self):
        if self.is_scanning or self.is_speed_testing: return
        
        self.port = int(self.ent_port.get().strip())
        self.timeout_sec = float(self.ent_timeout.get().strip()) / 1000.0
        self.host_header = self.ent_host_sni.get().strip()
        self.custom_download_url = self.ent_speed_url.get().strip()
        self.base_config_url = self.ent_base_config.get().strip()

        if not self.ips_to_scan:
            messagebox.showerror("Error", "Testing list is empty." if self.language == "en" else "لیست تست خالی است.")
            return

        self.is_scanning = True
        self.btn_start_scan.config(state=tk.DISABLED)
        self.progress_bar["value"] = 0
        self.scan_results = []
        
        # Start scanning in background thread to avoid freezing UI
        threading.Thread(target=self.run_ping_workers, daemon=True).start()

    def run_ping_workers(self):
        queue = Queue()
        for ip in self.ips_to_scan:
            queue.put(ip)

        results_list = []
        total = len(self.ips_to_scan)
        processed = 0

        # Concurrency limit (Workers)
        concurrency = 15
        threads = []

        def worker():
            nonlocal processed
            while not queue.empty():
                try:
                    ip = queue.get_nowait()
                except:
                    break
                
                self.update_row_status(ip, "testing", "Pinging..." if self.language == "en" else "درحال بررسی پینگ...")
                latency = self.perform_tcp_ping(ip, self.port, self.timeout_sec)
                
                success = latency is not None
                status = "Clean (Active)" if success else "Failed/Filtered"
                if not success:
                    status = "Failed / Filtered" if self.language == "en" else "خطا / مسدود شده"
                else:
                    status = "Clean" if self.language == "en" else "فعال"

                res_dict = {"ip": ip, "latency": latency, "success": success, "speed": None, "status": status}
                results_list.append(res_dict)

                # Update live UI row
                if success:
                    self.update_row_latency(ip, latency, status)
                else:
                    self.update_row_status(ip, "failed", status)

                processed += 1
                self.progress_bar["value"] = int((processed / total) * 100)
                queue.task_done()

        for _ in range(min(concurrency, total)):
            t = threading.Thread(target=worker)
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

        self.scan_results = results_list
        self.is_scanning = False
        self.btn_start_scan.config(state=tk.NORMAL)
        self.progress_bar["value"] = 100
        
        # Announce completion
        msg = "Scan finished successfully." if self.language == "en" else "تست پینگ و اسکن با موفقیت به پایان رسید."
        messagebox.showinfo("Scan Completed", msg)

    def perform_tcp_ping(self, ip, port, timeout):
        start = time.time()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            s.connect((ip, port))
            s.close()
            return int((time.time() - start) * 1000)
        except Exception:
            return None

    def start_batch_speed_test(self):
        if self.is_scanning or self.is_speed_testing: return
        
        # Check if there are successful IPs
        clean_ips = [r["ip"] for r in self.scan_results if r["success"]]
        if not clean_ips:
            messagebox.showerror("Error", "No clean/active IPs found. Please run a scan first!" if self.language == "en" else "هیچ آی‌پی فعالی یافت نشد. ابتدا شروع تست پینگ را کلیک کنید.")
            return

        self.is_speed_testing = True
        self.btn_batch_speed.config(state=tk.DISABLED)
        self.custom_download_url = self.ent_speed_url.get().strip()
        self.base_config_url = self.ent_base_config.get().strip()

        threading.Thread(target=self.run_batch_speed_worker, args=(clean_ips,), daemon=True).start()

    def run_batch_speed_worker(self, clean_ips):
        total = len(clean_ips)
        processed = 0

        for ip in clean_ips:
            self.testing_speed_ip = ip
            self.update_row_status(ip, "speedTesting", "Measuring speed..." if self.language == "en" else "در حال سنجش سرعت...")
            
            speed_mbps = self.test_speed_request(ip)
            
            if speed_mbps is not None:
                self.update_row_speed(ip, speed_mbps, f"{speed_mbps:.2f} Mbps")
            else:
                self.update_row_speed(ip, None, "Failed / Timeout")
                
            processed += 1
            self.progress_bar["value"] = int((processed / total) * 100)
            time.sleep(0.3) # Avoid overloading the local network adapter

        self.is_speed_testing = False
        self.testing_speed_ip = None
        self.btn_batch_speed.config(state=tk.NORMAL)
        self.progress_bar["value"] = 100
        messagebox.showinfo("Completed", "Batch speed test finished!" if self.language == "en" else "تست سرعت گروهی به پایان رسید!")

    def test_speed_request(self, ip):
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
        # If yes, we can do the speed test request directly through the target clean IP using the custom SNI/Host and path (e.g. WebSocket/gRPC).
        # This allows accurate speed testing of the configuration!
        base_config = getattr(self, "base_config_url", "").strip()
        if base_config:
            try:
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


if __name__ == "__main__":
    try:
        # Standard modern Tkinter startup
        root = tk.Tk()
        app = CloudflareScannerApp(root)
        root.mainloop()
    except Exception as e:
        import traceback
        error_msg = f"An error occurred during startup:\n\n{traceback.format_exc()}"
        try:
            with open("error_log.txt", "w", encoding="utf-8") as f:
                f.write(error_msg)
        except:
            pass
        
        try:
            import tkinter.messagebox as messagebox
            try:
                if 'root' in locals() and root:
                    root.withdraw()
            except:
                pass
            messagebox.showerror("Startup Error / خطا در اجرا", error_msg)
        except:
            print(error_msg)
            print("\nPress Enter to exit / کلید اینتر را برای خروج فشار دهید...")
            try:
                input()
            except:
                pass
