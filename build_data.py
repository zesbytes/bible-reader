import os
import re
import json
import pandas as pd

EXCEL_FILE = "bsb.xlsx"
VERSION_ID = "BSB"
VERSION_NAME = "Berean Standard Bible"
OUTPUT_DIR = "data"
OT_COUNT = 23145

BOOKS_CONFIG = [
    {"id": "GEN", "name": "Genesis", "abbreviations": ["Gen", "Ge", "Gn"], "firstChapter": 1, "lastChapter": 50, "testament": "OT"},
    {"id": "EXO", "name": "Exodus", "abbreviations": ["Exo", "Ex", "Exod"], "firstChapter": 1, "lastChapter": 40, "testament": "OT"},
    {"id": "LEV", "name": "Leviticus", "abbreviations": ["Lev", "Le", "Lv"], "firstChapter": 1, "lastChapter": 27, "testament": "OT"},
    {"id": "NUM", "name": "Numbers", "abbreviations": ["Num", "Nu", "Nm", "Nb"], "firstChapter": 1, "lastChapter": 36, "testament": "OT"},
    {"id": "DEU", "name": "Deuteronomy", "abbreviations": ["Deut", "Deu", "Dt"], "firstChapter": 1, "lastChapter": 34, "testament": "OT"},
    {"id": "JOS", "name": "Joshua", "abbreviations": ["Josh", "Jos", "Jsh"], "firstChapter": 1, "lastChapter": 24, "testament": "OT"},
    {"id": "JDG", "name": "Judges", "abbreviations": ["Judg", "Jdg", "Jg", "Jdgs"], "firstChapter": 1, "lastChapter": 21, "testament": "OT"},
    {"id": "RUT", "name": "Ruth", "abbreviations": ["Rth", "Ru"], "firstChapter": 1, "lastChapter": 4, "testament": "OT"},
    {"id": "1SA", "name": "1 Samuel", "abbreviations": ["1Sam", "1Sa", "1S", "I Sam", "1 Sam"], "firstChapter": 1, "lastChapter": 31, "testament": "OT"},
    {"id": "2SA", "name": "2 Samuel", "abbreviations": ["2Sam", "2Sa", "2S", "II Sam", "2 Sam"], "firstChapter": 1, "lastChapter": 24, "testament": "OT"},
    {"id": "1KI", "name": "1 Kings", "abbreviations": ["1Kgs", "1Ki", "1K", "I Kgs", "1 Kings"], "firstChapter": 1, "lastChapter": 22, "testament": "OT"},
    {"id": "2KI", "name": "2 Kings", "abbreviations": ["2Kgs", "2Ki", "2K", "II Kgs", "2 Kings"], "firstChapter": 1, "lastChapter": 25, "testament": "OT"},
    {"id": "1CH", "name": "1 Chronicles", "abbreviations": ["1Chr", "1Ch", "1 Chron", "I Chr"], "firstChapter": 1, "lastChapter": 29, "testament": "OT"},
    {"id": "2CH", "name": "2 Chronicles", "abbreviations": ["2Chr", "2Ch", "2 Chron", "II Chr"], "firstChapter": 1, "lastChapter": 36, "testament": "OT"},
    {"id": "EZR", "name": "Ezra", "abbreviations": ["Ezr", "Ez"], "firstChapter": 1, "lastChapter": 10, "testament": "OT"},
    {"id": "NEH", "name": "Nehemiah", "abbreviations": ["Neh", "Ne"], "firstChapter": 1, "lastChapter": 13, "testament": "OT"},
    {"id": "EST", "name": "Esther", "abbreviations": ["Esth", "Est", "Es"], "firstChapter": 1, "lastChapter": 10, "testament": "OT"},
    {"id": "JOB", "name": "Job", "abbreviations": ["Job", "Jb"], "firstChapter": 1, "lastChapter": 42, "testament": "OT"},
    {"id": "PSA", "name": "Psalms", "abbreviations": ["Psa", "Ps", "Psalm", "Pslm"], "firstChapter": 1, "lastChapter": 150, "testament": "OT"},
    {"id": "PRO", "name": "Proverbs", "abbreviations": ["Prov", "Pro", "Pr", "Prv"], "firstChapter": 1, "lastChapter": 31, "testament": "OT"},
    {"id": "ECC", "name": "Ecclesiastes", "abbreviations": ["Eccl", "Ecc", "Ec", "Qoh"], "firstChapter": 1, "lastChapter": 12, "testament": "OT"},
    {"id": "SNG", "name": "Song of Solomon", "abbreviations": ["Song", "SOS", "Canticles", "Cant"], "firstChapter": 1, "lastChapter": 8, "testament": "OT"},
    {"id": "ISA", "name": "Isaiah", "abbreviations": ["Isa", "Is"], "firstChapter": 1, "lastChapter": 66, "testament": "OT"},
    {"id": "JER", "name": "Jeremiah", "abbreviations": ["Jer", "Jr"], "firstChapter": 1, "lastChapter": 52, "testament": "OT"},
    {"id": "LAM", "name": "Lamentations", "abbreviations": ["Lam", "La"], "firstChapter": 1, "lastChapter": 5, "testament": "OT"},
    {"id": "EZK", "name": "Ezekiel", "abbreviations": ["Ezek", "Ezk", "Eze"], "firstChapter": 1, "lastChapter": 48, "testament": "OT"},
    {"id": "DAN", "name": "Daniel", "abbreviations": ["Dan", "Da", "Dn"], "firstChapter": 1, "lastChapter": 12, "testament": "OT"},
    {"id": "HOS", "name": "Hosea", "abbreviations": ["Hos", "Ho"], "firstChapter": 1, "lastChapter": 14, "testament": "OT"},
    {"id": "JOL", "name": "Joel", "abbreviations": ["Joel", "Joe", "Jl"], "firstChapter": 1, "lastChapter": 3, "testament": "OT"},
    {"id": "AMO", "name": "Amos", "abbreviations": ["Amos", "Am"], "firstChapter": 1, "lastChapter": 9, "testament": "OT"},
    {"id": "OBA", "name": "Obadiah", "abbreviations": ["Obad", "Oba", "Ob"], "firstChapter": 1, "lastChapter": 1, "testament": "OT"},
    {"id": "JON", "name": "Jonah", "abbreviations": ["Jonah", "Jon", "Jnh"], "firstChapter": 1, "lastChapter": 4, "testament": "OT"},
    {"id": "MIC", "name": "Micah", "abbreviations": ["Mic", "Mc"], "firstChapter": 1, "lastChapter": 7, "testament": "OT"},
    {"id": "NAM", "name": "Nahum", "abbreviations": ["Nah", "Na"], "firstChapter": 1, "lastChapter": 3, "testament": "OT"},
    {"id": "HAB", "name": "Habakkuk", "abbreviations": ["Hab", "Hb"], "firstChapter": 1, "lastChapter": 3, "testament": "OT"},
    {"id": "ZEP", "name": "Zephaniah", "abbreviations": ["Zeph", "Zep", "Zp"], "firstChapter": 1, "lastChapter": 3, "testament": "OT"},
    {"id": "HAG", "name": "Haggai", "abbreviations": ["Hag", "Hg"], "firstChapter": 1, "lastChapter": 2, "testament": "OT"},
    {"id": "ZEC", "name": "Zechariah", "abbreviations": ["Zech", "Zec", "Zc"], "firstChapter": 1, "lastChapter": 14, "testament": "OT"},
    {"id": "MAL", "name": "Malachi", "abbreviations": ["Mal", "Ml"], "firstChapter": 1, "lastChapter": 4, "testament": "OT"},
    {"id": "MAT", "name": "Matthew", "abbreviations": ["Matt", "Mat", "Mt"], "firstChapter": 1, "lastChapter": 28, "testament": "NT"},
    {"id": "MRK", "name": "Mark", "abbreviations": ["Mark", "Mrk", "Mk"], "firstChapter": 1, "lastChapter": 16, "testament": "NT"},
    {"id": "LUK", "name": "Luke", "abbreviations": ["Luke", "Luk", "Lk"], "firstChapter": 1, "lastChapter": 24, "testament": "NT"},
    {"id": "JHN", "name": "John", "abbreviations": ["John", "Jhn", "Jn"], "firstChapter": 1, "lastChapter": 21, "testament": "NT"},
    {"id": "ACT", "name": "Acts", "abbreviations": ["Acts", "Act", "Ac"], "firstChapter": 1, "lastChapter": 28, "testament": "NT"},
    {"id": "ROM", "name": "Romans", "abbreviations": ["Rom", "Ro", "Rm"], "firstChapter": 1, "lastChapter": 16, "testament": "NT"},
    {"id": "1CO", "name": "1 Corinthians", "abbreviations": ["1Cor", "1Co", "I Cor", "1 Cor"], "firstChapter": 1, "lastChapter": 16, "testament": "NT"},
    {"id": "2CO", "name": "2 Corinthians", "abbreviations": ["2Cor", "2Co", "II Cor", "2 Cor"], "firstChapter": 1, "lastChapter": 13, "testament": "NT"},
    {"id": "GAL", "name": "Galatians", "abbreviations": ["Gal", "Ga"], "firstChapter": 1, "lastChapter": 6, "testament": "NT"},
    {"id": "EPH", "name": "Ephesians", "abbreviations": ["Eph", "Ep"], "firstChapter": 1, "lastChapter": 6, "testament": "NT"},
    {"id": "PHP", "name": "Philippians", "abbreviations": ["Phil", "Php", "Pp"], "firstChapter": 1, "lastChapter": 4, "testament": "NT"},
    {"id": "COL", "name": "Colossians", "abbreviations": ["Col", "Co"], "firstChapter": 1, "lastChapter": 4, "testament": "NT"},
    {"id": "1TH", "name": "1 Thessalonians", "abbreviations": ["1Thess", "1Th", "I Thess", "1 Thess"], "firstChapter": 1, "lastChapter": 5, "testament": "NT"},
    {"id": "2TH", "name": "2 Thessalonians", "abbreviations": ["2Thess", "2Th", "II Thess", "2 Thess"], "firstChapter": 1, "lastChapter": 3, "testament": "NT"},
    {"id": "1TI", "name": "1 Timothy", "abbreviations": ["1Tim", "1Ti", "I Tim", "1 Tim"], "firstChapter": 1, "lastChapter": 6, "testament": "NT"},
    {"id": "2TI", "name": "2 Timothy", "abbreviations": ["2Tim", "2Ti", "II Tim", "2 Tim"], "firstChapter": 1, "lastChapter": 4, "testament": "NT"},
    {"id": "TIT", "name": "Titus", "abbreviations": ["Tit", "Ti"], "firstChapter": 1, "lastChapter": 3, "testament": "NT"},
    {"id": "PHM", "name": "Philemon", "abbreviations": ["Phlm", "Phm", "Pm"], "firstChapter": 1, "lastChapter": 1, "testament": "NT"},
    {"id": "HEB", "name": "Hebrews", "abbreviations": ["Heb", "He"], "firstChapter": 1, "lastChapter": 13, "testament": "NT"},
    {"id": "JAS", "name": "James", "abbreviations": ["Jas", "Jm"], "firstChapter": 1, "lastChapter": 5, "testament": "NT"},
    {"id": "1PE", "name": "1 Peter", "abbreviations": ["1Pet", "1Pe", "1Pt", "I Pet", "1 Pet"], "firstChapter": 1, "lastChapter": 5, "testament": "NT"},
    {"id": "2PE", "name": "2 Peter", "abbreviations": ["2Pet", "2Pe", "2Pt", "II Pet", "2 Pet"], "firstChapter": 1, "lastChapter": 3, "testament": "NT"},
    {"id": "1JN", "name": "1 John", "abbreviations": ["1John", "1Jn", "1J", "I Jn", "1 Jn"], "firstChapter": 1, "lastChapter": 5, "testament": "NT"},
    {"id": "2JN", "name": "2 John", "abbreviations": ["2John", "2Jn", "2J", "II Jn", "2 Jn"], "firstChapter": 1, "lastChapter": 1, "testament": "NT"},
    {"id": "3JN", "name": "3 John", "abbreviations": ["3John", "3Jn", "3J", "III Jn", "3 Jn"], "firstChapter": 1, "lastChapter": 1, "testament": "NT"},
    {"id": "JUD", "name": "Jude", "abbreviations": ["Jude", "Jud", "Jd"], "firstChapter": 1, "lastChapter": 1, "testament": "NT"},
    {"id": "REV", "name": "Revelation", "abbreviations": ["Rev", "Re", "Rv"], "firstChapter": 1, "lastChapter": 22, "testament": "NT"},
]

name_to_cfg = {b["name"]: b for b in BOOKS_CONFIG}
name_to_cfg["Psalm"] = name_to_cfg["Psalms"]

def build():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    version_dir = os.path.join(OUTPUT_DIR, VERSION_ID)
    search_dir = os.path.join(version_dir, "search")
    os.makedirs(search_dir, exist_ok=True)

    print(f"Reading {EXCEL_FILE}...")
    df = pd.read_excel(EXCEL_FILE, header=None)
    verses_df = df.iloc[3:].copy()
    verses_df.columns = ["id", "reference", "text"]

    ref_pat = re.compile(r"^(.+?)\s+(\d+):(\d+)$")
    chap_counts = {b["id"]: [0] * b["lastChapter"] for b in BOOKS_CONFIG}
    chapters = {}
    ot_lines = []
    nt_lines = []

    for _, row in verses_df.iterrows():
        vid = int(row["id"])
        raw_ref = str(row["reference"]).strip()
        m = ref_pat.match(raw_ref)
        if not m:
            continue
        book_name, chap_str, verse_str = m.groups()
        b_cfg = name_to_cfg[book_name]
        b_id = b_cfg["id"]
        c_num = int(chap_str)
        v_num = int(verse_str)
        text = str(row["text"]).strip()

        chap_counts[b_id][c_num - 1] += 1

        key = (b_id, c_num)
        if key not in chapters:
            chapters[key] = []
        while len(chapters[key]) < v_num - 1:
            chapters[key].append("")
        chapters[key].append(text)

        if vid <= OT_COUNT:
            ot_lines.append(text)
        else:
            nt_lines.append(text)

    for b in BOOKS_CONFIG:
        b["chapterVerses"] = chap_counts[b["id"]]

    meta_path = os.path.join(OUTPUT_DIR, "metadata.json")
    metadata = {
        "defaultVersion": VERSION_ID,
        "versions": [{"id": VERSION_ID, "name": VERSION_NAME, "abbr": VERSION_ID}],
        "books": BOOKS_CONFIG
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print("Created metadata.json with chapter verse offsets.")

    print("Writing chapter JSON files...")
    for (b_id, c_num), verses in chapters.items():
        folder = os.path.join(version_dir, b_id)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, f"{c_num}.json"), "w", encoding="utf-8") as out:
            json.dump(verses, out, ensure_ascii=False, indent=2)

    print("Writing formatted ot.txt and nt.txt...")
    with open(os.path.join(search_dir, "ot.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(ot_lines))
    with open(os.path.join(search_dir, "nt.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(nt_lines))

    print("Build complete!")

if __name__ == "__main__":
    build()