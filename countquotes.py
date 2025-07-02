import re
import requests
import os
import tkinter as tk
from tkinter import filedialog
import html
from collections import Counter

def count_at_words(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find all words that start with @ and are followed by word characters (letters, numbers, or _)
    at_words = re.findall(r'@\w+', content)
    # Exclude '@latest' and '@font'
    at_words = [word for word in at_words if word.lower() not in ("@latest", "@font")]
    counts = Counter(at_words)
    # Sort by count descending, then by word
    for word, count in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        print(f"{word}: {count}")
    print(f"Total unique @words: {len(counts)}")
    return counts

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(
        title="Select file containing links",
        filetypes=[("JSON Files", "*.json")]
    )
    if file_path:
        count_at_words(file_path)
    else:
        print("No file selected.")