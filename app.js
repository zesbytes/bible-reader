let metadata = null;
let currentBookIndex = 0;
let currentChapter = 1;
let currentTargetVerse = null;

const bookSelect = document.getElementById("book-select");
const chapterSelect = document.getElementById("chapter-select");
const currentRefLabel = document.getElementById("current-reference");
const chapterContent = document.getElementById("chapter-content");
const searchInput = document.getElementById("quick-search");
const searchBtn = document.getElementById("search-btn");

const btnPrevBook = document.getElementById("btn-prev-book");
const btnNextBook = document.getElementById("btn-next-book");
const btnPrevChapter = document.getElementById("btn-prev-chapter");
const btnNextChapter = document.getElementById("btn-next-chapter");

async function init() {
  try {
    const res = await fetch("data/metadata.json");
    if (!res.ok) throw new Error("metadata.json not found");
    metadata = await res.json();

    populateBookDropdown();
    setupEventListeners();

    if (!handleHashChange()) {
      loadChapter(0, 1);
    }
  } catch (err) {
    console.error(err);
    chapterContent.innerHTML = "<p>Error loading Bible metadata. Please ensure data/metadata.json exists.</p>";
  }
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

  currentRefLabel.textContent = `${book.name} ${currentChapter}`;
  updateNavButtons();

  const url = `data/${book.id}/${currentChapter}.json`;
  chapterContent.innerHTML = "<p>Loading chapter...</p>";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("File not found");
    const verses = await res.json();
    renderVerses(verses);

    if (currentTargetVerse) {
      scrollToVerse(currentTargetVerse);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const hash = targetVerse
      ? `${book.id}/${currentChapter}/${targetVerse}`
      : `${book.id}/${currentChapter}`;
    if (window.location.hash.replace("#", "") !== hash) {
      history.pushState(null, "", `#${hash}`);
    }
  } catch (err) {
    chapterContent.innerHTML = `<p>Unable to load content for ${book.name} ${currentChapter} (${url}).</p>`;
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

  btnPrevBook.disabled = currentBookIndex <= 0;
  btnNextBook.disabled = currentBookIndex >= metadata.books.length - 1;

  btnPrevChapter.disabled = currentBookIndex === 0 && currentChapter === book.firstChapter;
  btnNextChapter.disabled =
    currentBookIndex === metadata.books.length - 1 && currentChapter === book.lastChapter;
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
  } else {
    alert("Reference not recognized. Examples: 'John 3:16', '1Cor 13', 'Gen 1'");
  }
}

function handleHashChange() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return false;
  const parts = hash.split("/");
  const bookId = parts[0];
  const chapter = parts[1] || 1;
  const verse = parts[2] || null;

  const idx = metadata.books.findIndex((b) => b.id.toUpperCase() === bookId.toUpperCase());
  if (idx !== -1) {
    loadChapter(idx, chapter, verse);
    return true;
  }
  return false;
}

function setupEventListeners() {
  bookSelect.addEventListener("change", (e) => loadChapter(parseInt(e.target.value, 10), 1));
  chapterSelect.addEventListener("change", (e) => loadChapter(currentBookIndex, parseInt(e.target.value, 10)));

  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  btnPrevBook.addEventListener("click", () => {
    if (currentBookIndex > 0) loadChapter(currentBookIndex - 1, 1);
  });

  btnNextBook.addEventListener("click", () => {
    if (currentBookIndex < metadata.books.length - 1) loadChapter(currentBookIndex + 1, 1);
  });

  btnPrevChapter.addEventListener("click", () => {
    const book = metadata.books[currentBookIndex];
    if (currentChapter > book.firstChapter) {
      loadChapter(currentBookIndex, currentChapter - 1);
    } else if (currentBookIndex > 0) {
      const prevBook = metadata.books[currentBookIndex - 1];
      loadChapter(currentBookIndex - 1, prevBook.lastChapter);
    }
  });

  btnNextChapter.addEventListener("click", () => {
    const book = metadata.books[currentBookIndex];
    if (currentChapter < book.lastChapter) {
      loadChapter(currentBookIndex, currentChapter + 1);
    } else if (currentBookIndex < metadata.books.length - 1) {
      loadChapter(currentBookIndex + 1, 1);
    }
  });

  window.addEventListener("hashchange", handleHashChange);
}

window.addEventListener("DOMContentLoaded", init);
