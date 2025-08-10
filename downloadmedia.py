import requests, os, json, re
import tkinter as tk
from tkinter import filedialog
from bs4 import BeautifulSoup  # pip install beautifulsoup4

TENOR_REGEX = re.compile(r"https?://tenor\.com/view/[^\s]+")

def download_file(url, filepath):
    if os.path.exists(filepath):
        print(f"File already exists: {filepath}")
        return

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        with open(filepath, "wb") as out_file:
            out_file.write(response.content)
        print(f"Downloaded: {url} -> {filepath}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

def get_tenor_gif_url(tenor_url):
    try:
        res = requests.get(tenor_url, timeout=10)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            return og_image["content"]
    except Exception as e:
        print(f"Failed to extract GIF from Tenor link {tenor_url}: {e}")
    return None

def download_attachments(file_path, download_dir="#quotes"):
    with open(file_path, "r", encoding="utf-8") as f:
        channel_data = json.load(f)

    os.makedirs(download_dir, exist_ok=True)
    messages = channel_data.get("messages", [])

    for message in messages:
        timestamp = message.get("timestamp", "").replace(":", "-")
        
        content = message.get("content", "")
        tenor_match = TENOR_REGEX.search(content)
        if tenor_match:
            tenor_url = tenor_match.group(0)
            gif_url = get_tenor_gif_url(tenor_url)
            if gif_url:
                slug = tenor_url.rstrip("/").split("/")[-1]  # last part after '/'
                filename = f"{slug}.gif"
                filepath = os.path.join(download_dir, filename)
                download_file(gif_url, filepath)

        attachments = message.get("attachments", [])
        for attachment in attachments:
            url = attachment.get("url")
            if not url:
                continue
            url_filename = os.path.basename(url.split("?")[0])
            filename = f"{timestamp}-{url_filename}"
            filepath = os.path.join(download_dir, filename)
            download_file(url, filepath)

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select the JSON file for the channel",
        filetypes=[("JSON Files", "*.json")]
    )
    if file_path:
        download_dir = filedialog.askdirectory(
            title="Select download directory"
        )
        if download_dir:
            download_attachments(file_path, download_dir)
        else:
            print("No download directory selected.")
    else:
        print("No file selected.")
