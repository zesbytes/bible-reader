import os
import re
import pandas as pd

OUTPUT_DIR = "data/BSB/search"
os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_excel("bsb.xlsx", header=None)
verses_df = df.iloc[3:].copy()
verses_df.columns = ["id", "reference", "text"]

# Genesis 1:1 to Malachi 4:6 = 23,145 verses
# Matthew 1:1 to Revelation 22:21 = 7,957 verses
OT_COUNT = 23145

clean_re = re.compile(r'[^a-z0-9\s]')

ot_lines = []
nt_lines = []

for idx, row in verses_df.iterrows():
    vid = int(row["id"])
    # Normalize: lowercase, strip punctuation, single whitespace
    text = clean_re.sub(' ', str(row["text"]).lower())
    clean_line = " ".join(text.split())

    if vid <= OT_COUNT:
        ot_lines.append(clean_line)
    else:
        nt_lines.append(clean_line)

with open(os.path.join(OUTPUT_DIR, "ot.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(ot_lines))

with open(os.path.join(OUTPUT_DIR, "nt.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(nt_lines))

print(f"Generated ot.txt ({len(ot_lines)} verses) and nt.txt ({len(nt_lines)} verses).")