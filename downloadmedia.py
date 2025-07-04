import re
import requests
import os
import tkinter as tk
from tkinter import filedialog
import html

def download_https_links(file_path, download_dir="downloads"):
    os.makedirs(download_dir, exist_ok=True)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    links = re.findall(r'https://[^\s"\'>]+', content)

    skip_exts = {'.css', '.js', '.woff2'}

    # Only keep links that start with the Discord CDN attachments URL
    links = [url for url in links if url.startswith("https://cdn.discordapp.com/attachments")]
    for idx, url in enumerate(links, 1):
        # Decode HTML entities in the URL (e.g., &amp; -> &)
        url = html.unescape(url)
        # Remove query parameters for filename, but keep full URL for download
        filename = os.path.basename(url.split("?", 1)[0]) or f"file_{idx}"
        ext = os.path.splitext(filename)[1].lower()
        if ext in skip_exts:
            print(f"[{idx}/{len(links)}] Skipped (by extension): {url}")
            continue
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            response.raise_for_status()

            filepath = os.path.join(download_dir, filename)
            if os.path.exists(filepath):
                print(f"[{idx}/{len(links)}] Skipped (already exists): {url}")
                continue
            with open(filepath, "wb") as out_file:
                out_file.write(response.content)
            print(f"[{idx}/{len(links)}] Downloaded: {url} -> {filepath}")
        except Exception as e:
            print(f"[{idx}/{len(links)}] Failed to download {url}: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select file containing links",
        filetypes=[("All Files", "*.*")]
    )
    if file_path:
        download_dir = filedialog.askdirectory(
            title="Select download directory"
        )
        if download_dir:
            download_https_links(file_path, download_dir)
        else:
            print("No download directory selected.")
    else:
        print("No file selected.")