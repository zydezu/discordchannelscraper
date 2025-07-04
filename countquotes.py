import re, json, os, requests
import tkinter as tk
from tkinter import filedialog
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
import seaborn as sns
from PIL import Image
import pytesseract
import difflib
import shutil

tesseract_path = shutil.which("tesseract.exe") or shutil.which("tesseract")
if tesseract_path:
    print(f"Found tesseract at: {tesseract_path}")
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
else:
    print("Tesseract not found in PATH, using fallback path.")
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

nickname_to_name = {}
other_nicknames = {}

def read_other_nicknames(file_path="other_nicknames.json"):
    with open("other_nicknames.json", "r", encoding="utf-8") as f:
        return json.load(f)

def generate_nickname_to_name(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        channel_data = json.load(f)

    messages = channel_data.get("messages", [])
    for message in messages:
        mentions = message.get("mentions", [])
        for mention in mentions:
            name = mention.get("name", "").lower()
            nickname = mention.get("nickname", "").replace(" ", "_")
            if name and nickname:
                nickname_to_name[nickname] = name

    return nickname_to_name

def grab_quotes_per_user(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        channel_data = json.load(f)

    messages = channel_data.get("messages", [])
    quote_data = []

    for message in messages:
        message_content = message.get("content", "").strip()
        if message_content:            
            timestamp = message.get("timestamp").split("T")[0]            
            mentions = re.findall(r'@\w+', message_content)
            for nickname in mentions:
                quote_data.append((timestamp, nickname.replace("@", "")))

    for data in quote_data:
        nickname = data[1][1:].replace(" ", "_")
        if nickname_to_name.get(nickname):
            print(f"Replacing {nickname} with {nickname_to_name[nickname]}")
            quote_data[quote_data.index(data)] = (data[0], f"@{nickname_to_name[nickname]}")

    return quote_data

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

def count_usernames_from_ocr(quote_data, folder_path="#quotes"):
    nicknames_lower = {nick.lower(): name for nick, name in nickname_to_name.items()}
    nickname_keys = list(nicknames_lower.keys())

    for name, nicknames in other_nicknames.items():
        nickname_to_name.setdefault(name.lower(), name)

        for nickname in nicknames:
            key = nickname.lower()
            if key not in nickname_to_name:
                nickname_to_name[key] = name

    for filename in os.listdir(folder_path):
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')):
            continue

        timestamp = filename.split("T")[0]

        image_path = os.path.join(folder_path, filename)
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image, lang="eng")
        words = text.split()

        for word in words:
            word_clean = word.strip("@,.:;!?").lower()

            # Exact match
            if word_clean in nicknames_lower:
                real_name = nicknames_lower[word_clean]
                quote_data.append((timestamp, real_name))
                print(f"Exact match: {word} in {filename} as {real_name}")
                continue

            # Fuzzy match (only if no exact match)
            close_matches = difflib.get_close_matches(word_clean, nickname_keys, n=1, cutoff=0.8)
            if close_matches:
                matched_nick = close_matches[0]
                real_name = nicknames_lower[matched_nick]
                quote_data.append((timestamp, real_name))
                print(f"Fuzzy match: '{word}' ≈ '{matched_nick}' → {real_name} in {filename}")

    return quote_data

def merge_usernames(quote_data):
    merged_data = []

    for timestamp, nickname in quote_data:
        normalized_nick = nickname.strip("@,.:;!?").lower()
        canonical_name = nickname_to_name.get(normalized_nick, nickname)
        merged_data.append((timestamp, canonical_name))

    return merged_data

def create_graph(quote_data):
    df = pd.DataFrame(quote_data, columns=["date", "user"])

    if df.empty:
        print("No quotes found.")
        return

    df["count"] = 1
    daily_counts = df.groupby(["date", "user"]).count().reset_index()
    pivot_df = daily_counts.pivot(index="date", columns="user", values="count").fillna(0)
    pivot_df.index = pd.to_datetime(pivot_df.index)
    pivot_df = pivot_df.sort_index()

    # Add a row one month before the first date, with all users at 0
    if not pivot_df.empty:
        min_date = pivot_df.index.min()
        start_date = (min_date - pd.DateOffset(months=1)).normalize()
        zero_row = pd.DataFrame(
            {col: 0 for col in pivot_df.columns},
            index=[start_date]
        )
        pivot_df = pd.concat([zero_row, pivot_df])
        pivot_df = pivot_df.sort_index()

    cumulative = pivot_df.cumsum()

    # Assign a color to each user in order
    user_list = list(cumulative.columns)
    colors = sns.color_palette("husl", len(user_list))  # Or use another palette
    color_map = {user: colors[i] for i, user in enumerate(user_list)}

    # Use it in the plot
    plt.figure(figsize=(12, 6))
    for nickname in cumulative.columns:
        plt.plot(cumulative.index, cumulative[nickname], label=nickname, color=color_map[nickname], alpha=0.7)

    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%B %Y'))
    plt.gca().xaxis.set_major_locator(mdates.MonthLocator(interval=1))

    plt.xticks(rotation=30)
    plt.title("Cumulative Quotes per User")
    plt.xlabel("Date")
    plt.ylabel("Cumulative Quotes")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select file containing links",
        filetypes=[("JSON Files", "*.json")]
    )
    if file_path:
        other_nicknames = read_other_nicknames("other_nicknames.json")
        generate_nickname_to_name(file_path)
        data = grab_quotes_per_user(file_path)
        download_attachments(file_path, "#quotes")
        data = count_usernames_from_ocr(data, "#quotes")
        data = merge_usernames(data)
        print(data)
        create_graph(data)
    else:
        print("No file selected.")