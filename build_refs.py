import os
import re
import json
import pandas as pd

EXCEL_FILE = "bsb.xlsx"
OUTPUT_FILE = "data/BSB/search/refs.json"

# Canonical 66 Books list
BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", 
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", 
    "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", 
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", 
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", 
    "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", 
    "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", 
    "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", 
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
]

NAME_TO_INDEX = {name: idx for idx, name in enumerate(BOOKS)}
NAME_TO_INDEX["Psalm"] = NAME_TO_INDEX["Psalms"]

print(f"Reading {EXCEL_FILE}...")
df = pd.read_excel(EXCEL_FILE, header=None)
verses_df = df.iloc[3:].copy()
verses_df.columns = ["id", "reference", "text"]

ref_pat = re.compile(r"^(.+?)\s+(\d+):(\d+)$")
refs_table = []

for _, row in verses_df.iterrows():
    m = ref_pat.match(str(row["reference"]).strip())
    if not m:
        continue
    book_name, chap_str, verse_str = m.groups()
    b_idx = NAME_TO_INDEX[book_name]
    refs_table.append(f"{b_idx}:{chap_str}:{verse_str}")

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(refs_table, f)

print(f"Done! Created {OUTPUT_FILE} with {len(refs_table)} verse mappings.")