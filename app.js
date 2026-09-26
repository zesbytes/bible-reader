let metadata = null;
let currentVersion = "BSB";
let currentBookIndex = 0;
let currentChapter = 1;
let currentTargetVerse = null;

// Search Cache State
let refsLookup = null;       // Array of "bookIndex:chapter:verse"
let searchCorpus = null;     // { ot: string[], nt: string[] }
let isPreloadingSearch = false;
const OT_OFFSET = 23145;     // Number of verses in the Old Testament

// DOM Elements
const versionSelect = document.getElementById("version-select");
const bookSelect = document.getElementById("book-select");
const chapterSelect = document.getElementById("chapter-select");
const chapterContent = document.getElementById("chapter-content");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");

// Search Panel Elements
const searchPanel = document.getElementById("search-results-panel");
const searchStatus = document.getElementById("search-status");
const searchResultsList = document.getElementById("search-results-list");
const closeSearchPanelBtn = document.getElementById("close-search-panel");

// Dual Navigation Elements (Top & Bottom Toolbars)
const allPrevBookBtns = document.querySelectorAll(".nav-prev-book");
const allNextBookBtns = document.querySelectorAll(".nav-next-book");
const allPrevChapBtns = document.querySelectorAll(".nav-prev-chap");
const allNextChapBtns = document.querySelectorAll(".nav-next-chap");
const allRefLabels = document.querySelectorAll(".current-reference");

// --- Initialization ---

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
    chapterContent.innerHTML = "<p style='color:#b91c1c; padding:1.5rem;'>Error loading Bible metadata. Please check that data/metadata.json is accessible.</p>";
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

// --- Chapter Loading & Rendering ---

async function loadChapter(bookIdx, chapterNum, targetVerse = null) {
  currentBookIndex = bookIdx;
  currentChapter = parseInt(chapterNum, 10);
  currentTargetVerse = targetVerse ? parseInt(targetVerse, 10) : null;

  const book = metadata.books[currentBookIndex];
  bookSelect.value = currentBookIndex;

  updateChapterDropdown(currentBookIndex);
  chapterSelect.value = currentChapter;
  versionSelect.value = currentVersion;

  const refText = `${book.name} ${currentChapter}`;
  allRefLabels.forEach((el) => {
    el.textContent = refText;
    el.title = `${refText} (${currentVersion})`;
  });
  updateNavButtons();

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
    chapterContent.innerHTML = `<p style="color:#b91c1c; padding:1.5rem 0;">Unable to load content for ${book.name} ${currentChapter} (${currentVersion}).<br><small>File expected: <code>${url}</code></small></p>`;
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

// --- Search: Reference vs Phrase ---

function parseReference(query) {
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

async function preloadSearchCorpus() {
  if (searchCorpus || isPreloadingSearch) return;
  isPreloadingSearch = true;

  try {
    const cache = await caches.open("bible-search-v1");
    const refsUrl = `data/${currentVersion}/search/refs.json`;
    const otUrl = `data/${currentVersion}/search/ot.txt`;
    const ntUrl = `data/${currentVersion}/search/nt.txt`;

    const fetchWithCache = async (url, isJson = false) => {
      let res = await cache.match(url);
      if (!res) {
        res = await fetch(url);
        if (res.ok) await cache.put(url, res.clone());
      }
      return isJson ? await res.json() : (await res.text()).split("\n");
    };

    const [refsData, otData, ntData] = await Promise.all([
      fetchWithCache(refsUrl, true),
      fetchWithCache(otUrl, false),
      fetchWithCache(ntUrl, false)
    ]);

    refsLookup = refsData;
    searchCorpus = { ot: otData, nt: ntData };
  } catch (err) {
    console.warn("Search corpus could not be preloaded:", err);
  } finally {
    isPreloadingSearch = false;
  }
}

async function executePhraseSearch(query) {
  searchPanel.classList.remove("hidden");
  searchStatus.textContent = "Loading search index...";
  searchResultsList.innerHTML = "";

  if (!searchCorpus) {
    await preloadSearchCorpus();
  }

  if (!searchCorpus || !refsLookup) {
    searchStatus.textContent = "Search index files (ot.txt / nt.txt / refs.json) not found on server.";
    return;
  }

  const cleanNeedle = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().replace(/\s+/g, " ");
  if (!cleanNeedle) {
    searchStatus.textContent = "Please enter valid text to search.";
    return;
  }

  searchStatus.textContent = `Searching for "${query}"...`;
  const results = [];

  // 1. Search OT (Verse IDs 1 to 23,145)
  for (let i = 0; i < searchCorpus.ot.length; i++) {
    if (searchCorpus.ot[i].includes(cleanNeedle)) {
      results.push({ vid: i + 1, snippet: searchCorpus.ot[i] });
    }
  }

  // 2. Search NT (Verse IDs 23,146 to 31,102)
  for (let i = 0; i < searchCorpus.nt.length; i++) {
    if (searchCorpus.nt[i].includes(cleanNeedle)) {
      results.push({ vid: OT_OFFSET + i + 1, snippet: searchCorpus.nt[i] });
    }
  }

  renderSearchResults(query, results);
}

function renderSearchResults(query, results) {
  searchResultsList.innerHTML = "";

  if (results.length === 0) {
    searchStatus.textContent = `No matches found for "${query}".`;
    return;
  }

  searchStatus.textContent = `Found ${results.length} result${results.length > 1 ? "s" : ""} for "${query}":`;
  const fragment = document.createDocumentFragment();

  results.forEach((item) => {
    const refString = refsLookup[item.vid - 1];
    if (!refString) return;

    const [bIdx, chap, verse] = refString.split(":");
    const book = metadata.books[parseInt(bIdx, 10)];

    const li = document.createElement("li");
    li.className = "search-item";

    const titleSpan = document.createElement("span");
    titleSpan.className = "search-item-ref";
    titleSpan.textContent = `${book.name} ${chap}:${verse}`;

    const textSpan = document.createElement("span");
    textSpan.className = "search-item-text";
    textSpan.textContent = item.snippet;

    li.appendChild(titleSpan);
    li.appendChild(textSpan);

    li.addEventListener("click", () => {
      searchPanel.classList.add("hidden");
      loadChapter(parseInt(bIdx, 10), parseInt(chap, 10), parseInt(verse, 10));
    });

    fragment.appendChild(li);
  });

  searchResultsList.appendChild(fragment);
}

function handleSearch() {
  const val = searchInput.value.trim();
  if (!val) return;

  const refResult = parseReference(val);
  if (refResult) {
    searchPanel.classList.add("hidden");
    loadChapter(refResult.bookIndex, refResult.chapter, refResult.verse);
    searchInput.value = "";
    searchInput.blur();
  } else {
    executePhraseSearch(val);
  }
}

// --- Navigation & Routing ---

function handleHashChange() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return false;
  const parts = hash.split("/");

  let ver = currentVersion;
  let bookId = "";
  let chapter = 1;
  let verse = null;

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
  // Preload search index in the background the first time the user focuses the input
  searchInput.addEventListener("focus", () => preloadSearchCorpus(), { once: true });

  versionSelect.addEventListener("change", (e) => {
    currentVersion = e.target.value;
    searchCorpus = null;
    refsLookup = null;
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

  closeSearchPanelBtn.addEventListener("click", () => {
    searchPanel.classList.add("hidden");
  });

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

  allPrevChapBtns.forEach((btn) => btn.addEventListener("click", navigatePrevChapter));
  allNextChapBtns.forEach((btn) => btn.addEventListener("click", navigateNextChapter));

  window.addEventListener("hashchange", handleHashChange);
}

window.addEventListener("DOMContentLoaded", init);