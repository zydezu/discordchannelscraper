import requests, os, json
import tkinter as tk
from tkinter import filedialog

def download_attachments(file_path, download_dir="#quotes"):
    with open(file_path, "r", encoding="utf-8") as f:
        channel_data = json.load(f)

    os.makedirs(download_dir, exist_ok=True)
    messages = channel_data.get("messages", [])

    for message in messages:
        timestamp = message.get("timestamp")
        attachments = message.get("attachments", [])
        for attachment in attachments:
            url = attachment.get("url")
            if not url:
                continue

            url_filename = os.path.basename(url.split("?")[0])
            filename = f"{timestamp.replace(":", "-")}-{url_filename}"
            filepath = os.path.join(download_dir, filename)

            if os.path.exists(filepath):
                print(f"File already exists: {filepath}")
                continue

            try:
                response = requests.get(url, timeout=10)
                response.raise_for_status()

                with open(filepath, "wb") as out_file:
                    out_file.write(response.content)
                print(f"Downloaded: {url} -> {filepath}")
            except Exception as e:
                print(f"Failed to download {url}: {e}")

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