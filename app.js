let metadata = null;
let currentVersion = "BSB";
let currentBookIndex = 0;
let currentChapter = 1;
let currentTargetVerse = null;

// DOM Elements
const versionSelect = document.getElementById("version-select");
const bookSelect = document.getElementById("book-select");
const chapterSelect = document.getElementById("chapter-select");
const chapterContent = document.getElementById("chapter-content");
const searchInput = document.getElementById("quick-search");
const searchBtn = document.getElementById("search-btn");

// Dual Navigation elements (Top & Bottom toolbars)
const allPrevBookBtns = document.querySelectorAll(".nav-prev-book");
const allNextBookBtns = document.querySelectorAll(".nav-next-book");
const allPrevChapBtns = document.querySelectorAll(".nav-prev-chap");
const allNextChapBtns = document.querySelectorAll(".nav-next-chap");
const allRefLabels = document.querySelectorAll(".current-reference");

async function init() {
  try {
    const res = await fetch("data/metadata.json");
    if (!res.ok) throw new Error("metadata.json not found");
    metadata = await res.json();

    currentVersion = metadata.defaultVersion || (metadata.versions && metadata.versions[0]?.id) || "BSB";

    populateVersionDropdown();
    populateBookDropdown();
    setupEventListeners();

    if (!handleHashChange()) {
      loadChapter(currentBookIndex, 1);
    }
  } catch (err) {
    console.error(err);
    chapterContent.innerHTML = "<p>Error loading Bible metadata. Please verify that data/metadata.json is accessible.</p>";
  }
}

function populateVersionDropdown() {
  versionSelect.innerHTML = "";
  if (!metadata.versions || metadata.versions.length === 0) {
    const opt = document.createElement("option");
    opt.value = currentVersion;
    opt.textContent = currentVersion;
    versionSelect.appendChild(opt);
    return;
  }

  metadata.versions.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.abbr || v.id;
    opt.title = v.name || v.id;
    if (v.id === currentVersion) opt.selected = true;
    versionSelect.appendChild(opt);
  });
}

function populateBookDropdown() {
  bookSelect.innerHTML = "";
  metadata.books.forEach((b, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });
}

function updateChapterDropdown(bookIdx) {
  chapterSelect.innerHTML = "";
  const b = metadata.books[bookIdx];
  for (let c = b.firstChapter; c <= b.lastChapter; c++) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `Chapter ${c}`;
    chapterSelect.appendChild(opt);
  }
}

async function loadChapter(bookIdx, chapterNum, targetVerse = null) {
  currentBookIndex = bookIdx;
  currentChapter = parseInt(chapterNum, 10);
  currentTargetVerse = targetVerse ? parseInt(targetVerse, 10) : null;

  const book = metadata.books[currentBookIndex];
  bookSelect.value = currentBookIndex;

  updateChapterDropdown(currentBookIndex);
  chapterSelect.value = currentChapter;
  versionSelect.value = currentVersion;

  // Update top & bottom labels and buttons
  const refText = `${book.name} ${currentChapter}`;
  allRefLabels.forEach((el) => {
    el.textContent = refText;
    el.title = `${refText} (${currentVersion})`;
  });
  updateNavButtons();

  // Load from subfolder: data/{VERSION}/{BOOK_ID}/{CHAPTER}.json
  const url = `data/${currentVersion}/${book.id}/${currentChapter}.json`;
  chapterContent.innerHTML = `<p style="color:var(--text-muted); padding:1rem 0;">Loading ${refText} (${currentVersion})...</p>`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const verses = await res.json();
    renderVerses(verses);

    if (currentTargetVerse) {
      scrollToVerse(currentTargetVerse);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const hash = targetVerse
      ? `${currentVersion}/${book.id}/${currentChapter}/${targetVerse}`
      : `${currentVersion}/${book.id}/${currentChapter}`;
    if (window.location.hash.replace("#", "") !== hash) {
      history.pushState(null, "", `#${hash}`);
    }
  } catch (err) {
    chapterContent.innerHTML = `<p style="color:#b91c1c; padding:1.5rem 0;">Unable to load content for ${book.name} ${currentChapter} in translation <strong>${currentVersion}</strong>.<br><small>File expected: <code>${url}</code></small></p>`;
  }
}

function renderVerses(versesArray) {
  chapterContent.innerHTML = "";
  versesArray.forEach((text, idx) => {
    const verseNum = idx + 1;
    const span = document.createElement("span");
    span.className = "verse-item";
    span.id = `v-${verseNum}`;

    const sup = document.createElement("sup");
    sup.className = "verse-num";
    sup.textContent = verseNum;

    span.appendChild(sup);
    span.appendChild(document.createTextNode(text + " "));
    chapterContent.appendChild(span);
  });
}

function scrollToVerse(verseNum) {
  setTimeout(() => {
    document.querySelectorAll(".verse-item.highlighted").forEach((el) => {
      el.classList.remove("highlighted");
    });
    const el = document.getElementById(`v-${verseNum}`);
    if (el) {
      el.classList.add("highlighted");
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}

function updateNavButtons() {
  const book = metadata.books[currentBookIndex];

  const isFirstBook = currentBookIndex <= 0;
  const isLastBook = currentBookIndex >= metadata.books.length - 1;
  const isFirstChap = isFirstBook && currentChapter === book.firstChapter;
  const isLastChap = isLastBook && currentChapter === book.lastChapter;

  allPrevBookBtns.forEach((btn) => (btn.disabled = isFirstBook));
  allNextBookBtns.forEach((btn) => (btn.disabled = isLastBook));
  allPrevChapBtns.forEach((btn) => (btn.disabled = isFirstChap));
  allNextChapBtns.forEach((btn) => (btn.disabled = isLastChap));
}

function parseSearch(query) {
  const clean = query.trim().replace(/\s+/g, " ");
  const regex = /^((?:[1-3]\s+)?[A-Za-z]+)\s*(\d+)?(?::|\s+)?(\d+)?$/;
  const match = clean.match(regex);

  if (!match) return null;

  const bookPart = match[1].toLowerCase().replace(/\s+/g, "");
  const chapterPart = match[2] ? parseInt(match[2], 10) : 1;
  const versePart = match[3] ? parseInt(match[3], 10) : null;

  const bookIndex = metadata.books.findIndex((b) => {
    if (b.name.toLowerCase().replace(/\s+/g, "") === bookPart) return true;
    return b.abbreviations.some((abbr) => abbr.toLowerCase().replace(/\s+/g, "") === bookPart);
  });

  if (bookIndex === -1) return null;
  return { bookIndex, chapter: chapterPart, verse: versePart };
}

function handleSearch() {
  const val = searchInput.value;
  if (!val) return;
  const result = parseSearch(val);
  if (result) {
    loadChapter(result.bookIndex, result.chapter, result.verse);
    searchInput.value = "";
    searchInput.blur();
  } else {
    alert("Reference not recognized. Examples: 'John 3:16', '1Cor 13', 'Gen 1'");
  }
}

function handleHashChange() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return false;
  const parts = hash.split("/");

  let ver = currentVersion;
  let bookId = "";
  let chapter = 1;
  let verse = null;

  // Check if first token is a known version ID
  const isVer = metadata.versions && metadata.versions.some((v) => v.id.toUpperCase() === parts[0].toUpperCase());
  if (isVer) {
    ver = parts[0].toUpperCase();
    bookId = parts[1] || "";
    chapter = parts[2] || 1;
    verse = parts[3] || null;
  } else {
    bookId = parts[0] || "";
    chapter = parts[1] || 1;
    verse = parts[2] || null;
  }

  currentVersion = ver;
  const idx = metadata.books.findIndex((b) => b.id.toUpperCase() === bookId.toUpperCase());
  if (idx !== -1) {
    loadChapter(idx, chapter, verse);
    return true;
  }
  return false;
}

function navigatePrevChapter() {
  const book = metadata.books[currentBookIndex];
  if (currentChapter > book.firstChapter) {
    loadChapter(currentBookIndex, currentChapter - 1);
  } else if (currentBookIndex > 0) {
    const prevBook = metadata.books[currentBookIndex - 1];
    loadChapter(currentBookIndex - 1, prevBook.lastChapter);
  }
}

function navigateNextChapter() {
  const book = metadata.books[currentBookIndex];
  if (currentChapter < book.lastChapter) {
    loadChapter(currentBookIndex, currentChapter + 1);
  } else if (currentBookIndex < metadata.books.length - 1) {
    loadChapter(currentBookIndex + 1, 1);
  }
}

function setupEventListeners() {
  versionSelect.addEventListener("change", (e) => {
    currentVersion = e.target.value;
    loadChapter(currentBookIndex, currentChapter, currentTargetVerse);
  });

  bookSelect.addEventListener("change", (e) => {
    loadChapter(parseInt(e.target.value, 10), 1);
  });

  chapterSelect.addEventListener("change", (e) => {
    loadChapter(currentBookIndex, parseInt(e.target.value, 10));
  });

  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  // Bind dual buttons (both top and bottom bars)
  allPrevBookBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentBookIndex > 0) loadChapter(currentBookIndex - 1, 1);
    });
  });

  allNextBookBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentBookIndex < metadata.books.length - 1) loadChapter(currentBookIndex + 1, 1);
    });
  });

  allPrevChapBtns.forEach((btn) => {
    btn.addEventListener("click", navigatePrevChapter);
  });

  allNextChapBtns.forEach((btn) => {
    btn.addEventListener("click", navigateNextChapter);
  });

  window.addEventListener("hashchange", handleHashChange);
}

window.addEventListener("DOMContentLoaded", init);