let metadata = null;
let currentVersion = "BSB";
let currentBookIndex = 0;
let currentChapter = 1;
let currentTargetVerse = null;

// In-Memory Search & Offline Cache
let memoryCorpus = null; // { ot: string[], nt: string[] }
let isDownloadingCorpus = false;

// DOM Elements
const versionSelect = document.getElementById("version-select");
const activeVersionLabel = document.getElementById("active-version-label");
const bookSelect = document.getElementById("book-select");
const chapterSelect = document.getElementById("chapter-select");
const chapterContent = document.getElementById("chapter-content");
const searchInput = document.getElementById("search-input") || document.getElementById("quick-search");
const searchBtn = document.getElementById("search-btn");
const offlineBtn = document.getElementById("offline-btn");

// Search Panel Elements
const searchPanel = document.getElementById("search-results-panel") || document.getElementById("search-panel");
const searchStatus = document.getElementById("search-status");
const searchResultsList = document.getElementById("search-results-list");
const closeSearchPanelBtn = document.getElementById("close-search-panel");

// Dual Navigation Elements
const allPrevBookBtns = document.querySelectorAll(".nav-prev-book, #btn-prev-book");
const allNextBookBtns = document.querySelectorAll(".nav-next-book, #btn-next-book");
const allPrevChapBtns = document.querySelectorAll(".nav-prev-chap, #btn-prev-chapter");
const allNextChapBtns = document.querySelectorAll(".nav-next-chap, #btn-next-chapter");
const allRefLabels = document.querySelectorAll(".current-reference, #current-reference");

// --- Initialization ---

async function init() {
  try {
    const res = await fetch("data/metadata.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch data/metadata.json`);
    metadata = await res.json();
  } catch (err) {
    console.error("Metadata load error:", err);
    if (chapterContent) {
      chapterContent.innerHTML = `<p style="color:#b91c1c; padding:1.5rem;">
        <strong>Error loading metadata:</strong> ${err.message}<br>
        <small>Verify that <code>data/metadata.json</code> is accessible.</small>
      </p>`;
    }
    return;
  }

  currentVersion = metadata.defaultVersion || (metadata.versions && metadata.versions[0]?.id) || "BSB";

  populateVersionDropdown();
  populateBookDropdown();
  setupEventListeners();
  checkOfflineStatus();

  // Handle URL hash routing or load Genesis 1
  if (!handleHashChange()) {
    loadChapter(currentBookIndex, 1);
  }

  // Adjust translation labels dynamically on resize (desktop full name vs mobile abbr)
  window.addEventListener("resize", populateVersionDropdown);
}

function getActiveVersionObj() {
  if (!metadata || !metadata.versions) return { id: currentVersion, name: currentVersion, abbr: currentVersion };
  return metadata.versions.find((v) => v.id.toUpperCase() === currentVersion.toUpperCase()) || {
    id: currentVersion,
    name: currentVersion,
    abbr: currentVersion
  };
}

function populateVersionDropdown() {
  if (!versionSelect || !metadata) return;
  const isMobile = window.innerWidth <= 580;
  const currentVal = versionSelect.value || currentVersion;

  versionSelect.innerHTML = "";
  const versions = metadata.versions && metadata.versions.length > 0 
    ? metadata.versions 
    : [{ id: currentVersion, name: currentVersion, abbr: currentVersion }];

  versions.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    // Desktop: "Berean Standard Bible (BSB)" | Mobile: "BSB"
    opt.textContent = isMobile ? (v.abbr || v.id) : (v.name ? `${v.name} (${v.abbr || v.id})` : v.id);
    opt.title = v.name || v.id;
    if (v.id === currentVal) opt.selected = true;
    versionSelect.appendChild(opt);
  });

  updateVersionLabels();
}

function updateVersionLabels() {
  const vObj = getActiveVersionObj();
  if (activeVersionLabel) {
    activeVersionLabel.textContent = vObj.name || vObj.id;
  }
}

function populateBookDropdown() {
  if (!bookSelect || !metadata) return;
  bookSelect.innerHTML = "";
  metadata.books.forEach((b, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });
}

function updateChapterDropdown(bookIdx) {
  if (!chapterSelect || !metadata) return;
  chapterSelect.innerHTML = "";
  const b = metadata.books[bookIdx];
  for (let c = b.firstChapter; c <= b.lastChapter; c++) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `Chapter ${c}`;
    chapterSelect.appendChild(opt);
  }
}

// --- Dynamic Slice from In-Memory Text Corpus ---

function sliceChapterFromMemory(bookIdx, chapNum) {
  if (!memoryCorpus) return null;
  const book = metadata.books[bookIdx];
  const lines = book.testament === "OT" ? memoryCorpus.ot : memoryCorpus.nt;
  if (!lines || lines.length === 0) return null;

  let offset = 0;
  for (let i = 0; i < bookIdx; i++) {
    const prevBook = metadata.books[i];
    if (prevBook.testament === book.testament && prevBook.chapterVerses) {
      offset += prevBook.chapterVerses.reduce((sum, v) => sum + v, 0);
    }
  }

  for (let c = 1; c < chapNum; c++) {
    offset += book.chapterVerses[c - 1];
  }

  const verseCount = book.chapterVerses[chapNum - 1];
  return lines.slice(offset, offset + verseCount);
}

// --- Chapter Loading & Display ---

async function loadChapter(bookIdx, chapterNum, targetVerse = null) {
  currentBookIndex = bookIdx;
  currentChapter = parseInt(chapterNum, 10);
  currentTargetVerse = targetVerse ? parseInt(targetVerse, 10) : null;

  const book = metadata.books[currentBookIndex];
  if (bookSelect) bookSelect.value = currentBookIndex;

  updateChapterDropdown(currentBookIndex);
  if (chapterSelect) chapterSelect.value = currentChapter;
  if (versionSelect) versionSelect.value = currentVersion;
  updateVersionLabels();

  const refText = `${book.name} ${currentChapter}`;
  allRefLabels.forEach((el) => {
    el.textContent = refText;
    el.title = `${refText} (${getActiveVersionObj().name})`;
  });
  updateNavButtons();

  // 1. Check if the chapter can be sliced from the downloaded memory corpus
  const memoryVerses = sliceChapterFromMemory(currentBookIndex, currentChapter);
  if (memoryVerses) {
    renderVerses(memoryVerses);
    completeChapterLoad(book, targetVerse);
    return;
  }

  // 2. Fall back to the individual chapter JSON file
  const url = `data/${currentVersion}/${book.id}/${currentChapter}.json`;
  if (chapterContent) {
    chapterContent.innerHTML = `<p style="color:var(--text-muted); padding:1rem 0;">Loading ${refText} (${currentVersion})...</p>`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const verses = await res.json();
    renderVerses(verses);
    completeChapterLoad(book, targetVerse);
  } catch (err) {
    if (chapterContent) {
      chapterContent.innerHTML = `<p style="color:#b91c1c; padding:1.5rem 0;">
        Unable to load <strong>${book.name} ${currentChapter}</strong> (${currentVersion}).<br>
        <small>File expected: <code>${url}</code></small>
      </p>`;
    }
  }
}

function completeChapterLoad(book, targetVerse) {
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
}

function renderVerses(versesArray) {
  if (!chapterContent) return;
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

// --- Offline & Cache Operations ---

async function checkOfflineStatus() {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(`bible-${currentVersion}`);
    const otRes = await cache.match(`data/${currentVersion}/search/ot.txt`);
    const ntRes = await cache.match(`data/${currentVersion}/search/nt.txt`);

    if (otRes && ntRes) {
      markOfflineReady();
      if (!memoryCorpus) {
        const [otText, ntText] = await Promise.all([otRes.text(), ntRes.text()]);
        memoryCorpus = { ot: otText.split("\n"), nt: ntText.split("\n") };
      }
    }
  } catch (e) {
    console.warn("Offline check skipped:", e);
  }
}

function markOfflineReady() {
  if (!offlineBtn) return;
  offlineBtn.classList.add("ready");
  offlineBtn.title = "Text is cached locally (Offline Ready)";
  const icon = offlineBtn.querySelector(".offline-icon");
  const text = offlineBtn.querySelector(".offline-text");
  if (icon) icon.innerHTML = "&#x2713;";
  if (text) text.textContent = "Offline Ready";
}

async function ensureCorpusLoaded() {
  if (memoryCorpus) return true;
  if (isDownloadingCorpus) return false;
  isDownloadingCorpus = true;

  try {
    const cache = "caches" in window ? await caches.open(`bible-${currentVersion}`) : null;
    const otUrl = `data/${currentVersion}/search/ot.txt`;
    const ntUrl = `data/${currentVersion}/search/nt.txt`;

    const fetchResource = async (url) => {
      let res = cache ? await cache.match(url) : null;
      if (!res) {
        res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
        if (cache) await cache.put(url, res.clone());
      }
      const raw = await res.text();
      return raw.split("\n");
    };

    const [otData, ntData] = await Promise.all([fetchResource(otUrl), fetchResource(ntUrl)]);
    memoryCorpus = { ot: otData, nt: ntData };
    markOfflineReady();
    return true;
  } catch (err) {
    console.error("Failed downloading corpus:", err);
    return false;
  } finally {
    isDownloadingCorpus = false;
  }
}

// --- Search Engine & Result Highlighting ---

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

function lineIndexToRef(lineIndex, testament) {
  let count = 0;
  for (let bIdx = 0; bIdx < metadata.books.length; bIdx++) {
    const b = metadata.books[bIdx];
    if (b.testament !== testament || !b.chapterVerses) continue;

    for (let c = 0; c < b.chapterVerses.length; c++) {
      const vCount = b.chapterVerses[c];
      if (lineIndex < count + vCount) {
        return {
          bookIndex: bIdx,
          bookName: b.name,
          chapter: c + 1,
          verse: (lineIndex - count) + 1
        };
      }
      count += vCount;
    }
  }
  return null;
}

function highlightSnippet(text, cleanQuery) {
  const words = cleanQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0) return escapeHTML(text);

  const escapedTerms = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts
    .map((part) => (regex.test(part) ? `<mark>${escapeHTML(part)}</mark>` : escapeHTML(part)))
    .join("");
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, (tag) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[tag] || tag));
}

async function executePhraseSearch(query) {
  if (searchPanel) searchPanel.classList.remove("hidden");
  if (searchStatus) searchStatus.textContent = "Loading translation text...";
  if (searchResultsList) searchResultsList.innerHTML = "";

  const loaded = await ensureCorpusLoaded();
  if (!loaded || !memoryCorpus) {
    if (searchStatus) {
      searchStatus.textContent = `Search files not found for ${currentVersion} in data/${currentVersion}/search/.`;
    }
    return;
  }

  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().replace(/\s+/g, " ");
  if (!cleanQuery) {
    if (searchStatus) searchStatus.textContent = "Please enter text to search.";
    return;
  }

  if (searchStatus) searchStatus.textContent = `Searching for "${query}"...`;
  const results = [];

  // 1. Search Old Testament
  for (let i = 0; i < memoryCorpus.ot.length; i++) {
    const raw = memoryCorpus.ot[i];
    if (raw.toLowerCase().includes(cleanQuery)) {
      const ref = lineIndexToRef(i, "OT");
      if (ref) results.push({ ...ref, text: raw });
    }
  }

  // 2. Search New Testament
  for (let i = 0; i < memoryCorpus.nt.length; i++) {
    const raw = memoryCorpus.nt[i];
    if (raw.toLowerCase().includes(cleanQuery)) {
      const ref = lineIndexToRef(i, "NT");
      if (ref) results.push({ ...ref, text: raw });
    }
  }

  renderSearchResults(query, cleanQuery, results);
}

function renderSearchResults(originalQuery, cleanQuery, results) {
  if (!searchResultsList) return;
  searchResultsList.innerHTML = "";

  if (results.length === 0) {
    if (searchStatus) searchStatus.textContent = `No matches found for "${originalQuery}".`;
    return;
  }

  if (searchStatus) {
    searchStatus.textContent = `Found ${results.length} match${results.length > 1 ? "es" : ""} for "${originalQuery}":`;
  }

  const fragment = document.createDocumentFragment();

  results.forEach((item) => {
    const li = document.createElement("li");
    li.className = "search-item";

    const titleSpan = document.createElement("span");
    titleSpan.className = "search-item-ref";
    titleSpan.textContent = `${item.bookName} ${item.chapter}:${item.verse}`;

    const textSpan = document.createElement("span");
    textSpan.className = "search-item-text";
    textSpan.innerHTML = highlightSnippet(item.text, cleanQuery);

    li.appendChild(titleSpan);
    li.appendChild(textSpan);

    li.addEventListener("click", () => {
      if (searchPanel) searchPanel.classList.add("hidden");
      loadChapter(item.bookIndex, item.chapter, item.verse);
    });

    fragment.appendChild(li);
  });

  searchResultsList.appendChild(fragment);
}

function handleSearch() {
  if (!searchInput) return;
  const val = searchInput.value.trim();
  if (!val) return;

  const refResult = parseReference(val);
  if (refResult) {
    if (searchPanel) searchPanel.classList.add("hidden");
    loadChapter(refResult.bookIndex, refResult.chapter, refResult.verse);
    searchInput.value = "";
    searchInput.blur();
  } else {
    executePhraseSearch(val);
  }
}

// --- Routing & Navigation ---

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
  if (versionSelect) {
    versionSelect.addEventListener("change", (e) => {
      currentVersion = e.target.value;
      memoryCorpus = null;
      if (offlineBtn) {
        offlineBtn.classList.remove("ready");
        const t = offlineBtn.querySelector(".offline-text");
        if (t) t.textContent = "Offline";
      }
      checkOfflineStatus();
      loadChapter(currentBookIndex, currentChapter, currentTargetVerse);
    });
  }

  if (bookSelect) {
    bookSelect.addEventListener("change", (e) => loadChapter(parseInt(e.target.value, 10), 1));
  }

  if (chapterSelect) {
    chapterSelect.addEventListener("change", (e) => loadChapter(currentBookIndex, parseInt(e.target.value, 10)));
  }

  if (searchBtn) searchBtn.addEventListener("click", handleSearch);
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleSearch();
    });
  }

  if (closeSearchPanelBtn && searchPanel) {
    closeSearchPanelBtn.addEventListener("click", () => searchPanel.classList.add("hidden"));
  }

  if (offlineBtn) {
    offlineBtn.addEventListener("click", async () => {
      offlineBtn.disabled = true;
      const text = offlineBtn.querySelector(".offline-text");
      if (text) text.textContent = "Downloading...";
      const success = await ensureCorpusLoaded();
      offlineBtn.disabled = false;
      if (success) {
        markOfflineReady();
      } else if (text) {
        text.textContent = "Error";
      }
    });
  }

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