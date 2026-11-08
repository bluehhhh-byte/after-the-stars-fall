/**
 * 『별이 지고 난 뒤에도』 — 3D Flip Mobile & Focus Web-Book Engine
 */
(function () {
  'use strict';

  const STORAGE_KEY_SETTINGS = 'after_stars_fall_settings_v1';
  const STORAGE_KEY_PROGRESS = 'after_stars_fall_progress_v1';
  const STORAGE_KEY_BOOKMARKS = 'after_stars_fall_bookmarks_v1';

  const FONT_MAP = {
    gowun: "'Gowun Batang', 'Noto Serif KR', serif",
    serif: "'Noto Serif KR', serif",
    myeongjo: "'Nanum Myeongjo', serif",
    sans: "'Pretendard', -apple-system, sans-serif"
  };

  const THEME_META_COLOR = {
    starlight: '#070b17',
    sepia: '#2b241d',
    paper: '#e4e7ec'
  };

  // Reader State
  const state = {
    theme: 'starlight',
    fontKey: 'gowun',
    fontSize: 18,
    lineHeight: 1.95,
    mode: 'flip', // 'flip' | 'scroll'
    pages: [],    // Array of page objects
    chapterStartPages: {}, // chapterId -> pageIndex
    currentPageIndex: 0,
    isFlipping: false,
    uiVisible: true,
    bookmarks: [], // Array of { chapterId, paraIndex, chapterTitle, snippet, savedAt }
    ttsStatus: 'stopped', // 'stopped' | 'playing' | 'paused'
    ttsRate: 1.0,
    ttsParaOffset: 0
  };

  // DOM Elements
  const el = {
    html: document.documentElement,
    metaThemeColor: document.getElementById('metaThemeColor'),
    starCanvas: document.getElementById('starfieldCanvas'),
    topBar: document.getElementById('topBar'),
    bottomBar: document.getElementById('bottomBar'),
    topChapterLabel: document.getElementById('topChapterLabel'),
    bottomChapterInfo: document.getElementById('bottomChapterInfo'),
    bottomPageCounter: document.getElementById('bottomPageCounter'),
    pageSlider: document.getElementById('pageSlider'),
    bookViewport: document.getElementById('bookViewport'),
    currentPage: document.getElementById('currentPage'),
    pageRibbon: document.getElementById('pageRibbon'),
    flipLayer: document.getElementById('flipLayer'),
    flipCard: document.getElementById('flipCard'),
    flipFront: document.getElementById('flipFront'),
    flipBack: document.getElementById('flipBack'),
    measureBox: document.getElementById('measureBox'),
    scrollViewport: document.getElementById('scrollViewport'),
    scrollContent: document.getElementById('scrollContent'),
    zonePrev: document.getElementById('zonePrev'),
    zoneCenter: document.getElementById('zoneCenter'),
    zoneNext: document.getElementById('zoneNext'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    btnOpenToc: document.getElementById('btnOpenToc'),
    btnCloseToc: document.getElementById('btnCloseToc'),
    tocDrawer: document.getElementById('tocDrawer'),
    drawerBackdrop: document.getElementById('drawerBackdrop'),
    tabBtnToc: document.getElementById('tabBtnToc'),
    tabBtnBookmarks: document.getElementById('tabBtnBookmarks'),
    tabPanelToc: document.getElementById('tabPanelToc'),
    tabPanelBookmarks: document.getElementById('tabPanelBookmarks'),
    tocList: document.getElementById('tocList'),
    bookmarkList: document.getElementById('bookmarkList'),
    bookmarkEmptyState: document.getElementById('bookmarkEmptyState'),
    bookmarkCountBadge: document.getElementById('bookmarkCountBadge'),
    btnBookmarkPage: document.getElementById('btnBookmarkPage'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    settingsPanel: document.getElementById('settingsPanel'),
    fontSizeVal: document.getElementById('fontSizeVal'),
    lineHeightVal: document.getElementById('lineHeightVal'),
    btnFontDec: document.getElementById('btnFontDec'),
    btnFontInc: document.getElementById('btnFontInc'),
    btnLineDec: document.getElementById('btnLineDec'),
    btnLineInc: document.getElementById('btnLineInc'),
    btnToggleMode: document.getElementById('btnToggleMode'),
    modeIcon: document.getElementById('modeIcon'),
    modeText: document.getElementById('modeText'),
    btnOpenTts: document.getElementById('btnOpenTts'),
    ttsPlayerBar: document.getElementById('ttsPlayerBar'),
    ttsWaveDot: document.getElementById('ttsWaveDot'),
    ttsStatusText: document.getElementById('ttsStatusText'),
    btnTtsPlayPause: document.getElementById('btnTtsPlayPause'),
    ttsPlayIcon: document.getElementById('ttsPlayIcon'),
    btnTtsStop: document.getElementById('btnTtsStop'),
    btnTtsSpeed: document.getElementById('btnTtsSpeed'),
    btnTtsClose: document.getElementById('btnTtsClose'),
    resumeToast: document.getElementById('resumeToast'),
    resumeToastMsg: document.getElementById('resumeToastMsg'),
    btnResumeYes: document.getElementById('btnResumeYes'),
    btnResumeClose: document.getElementById('btnResumeClose')
  };

  // =========================================================================
  // 1. Settings & Storage Persistence
  // =========================================================================
  function loadSavedSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme) state.theme = parsed.theme;
        if (parsed.fontKey && FONT_MAP[parsed.fontKey]) state.fontKey = parsed.fontKey;
        if (parsed.fontSize) state.fontSize = Math.min(26, Math.max(14, Number(parsed.fontSize)));
        if (parsed.lineHeight) state.lineHeight = Math.min(2.4, Math.max(1.5, Number(parsed.lineHeight)));
        if (parsed.mode === 'scroll' || parsed.mode === 'flip') state.mode = parsed.mode;
      }
      const bmRaw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
      if (bmRaw) {
        state.bookmarks = JSON.parse(bmRaw) || [];
      }
    } catch (e) {
      console.warn('Settings load skipped:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
        theme: state.theme,
        fontKey: state.fontKey,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        mode: state.mode
      }));
    } catch (e) {}
  }

  function saveReadingProgress() {
    if (state.currentPageIndex <= 0) return; // Don't overwrite progress with cover page
    const page = state.pages[state.currentPageIndex];
    if (!page || page.type === 'cover') return;
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify({
        chapterId: page.chapterId,
        paraIndex: page.startParaIndex || 0,
        chapterTitle: page.chapterTitle,
        pageIndex: state.currentPageIndex,
        totalPages: state.pages.length,
        updatedAt: Date.now()
      }));
    } catch (e) {}
  }

  function applyVisualSettings() {
    el.html.setAttribute('data-theme', state.theme);
    if (el.metaThemeColor) {
      el.metaThemeColor.setAttribute('content', THEME_META_COLOR[state.theme] || '#070b17');
    }
    el.html.style.setProperty('--font-reader', FONT_MAP[state.fontKey]);
    el.html.style.setProperty('--reader-font-size', state.fontSize + 'px');
    el.html.style.setProperty('--reader-line-height', String(state.lineHeight));

    el.fontSizeVal.textContent = state.fontSize + 'px';
    el.lineHeightVal.textContent = state.lineHeight.toFixed(2);

    document.querySelectorAll('[data-theme-select]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-select') === state.theme);
    });
    document.querySelectorAll('[data-font-select]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-font-select') === state.fontKey);
    });
  }

  // =========================================================================
  // 2. Smart Auto-Pagination Engine (Offscreen DOM Measurement)
  // =========================================================================
  function buildCoverPageObject() {
    return {
      type: 'cover',
      chapterId: 0,
      chapterTitle: '표지',
      startParaIndex: 0,
      endParaIndex: 0,
      html: `
        <div class="cover-layout">
          <div class="cover-frame">
            <div class="cover-top-section">
              <div class="cover-ornament-line"></div>
              <div class="cover-title-block">
                <h1>반추</h1>
                <span class="cover-hanja-sub">返 追</span>
              </div>
            </div>

            <div class="cover-center-section">
              <div class="cover-art">
                <div class="cover-star-orb"></div>
                <div class="cover-ripple"></div>
                <div class="cover-ripple-delay"></div>
              </div>
              <p class="cover-epigraph">
                <span class="epigraph-line">“가끔 길을 잃는 별들이 있어요.</span>
                <span class="epigraph-line epigraph-gap">여기는 잊지 못한 사람들이</span>
                <span class="epigraph-line">오는 곳이니까요.”</span>
              </p>
            </div>

            <div class="cover-cta-wrap">
              <button type="button" class="btn-open-book" data-action="open-first-chapter">
                책 펼치기 &rarr;
              </button>
              <span class="cover-date-meta">2026. 11. 9. 작성.</span>
            </div>
          </div>
        </div>
      `
    };
  }

  function paginateNovel() {
    const novel = window.NOVEL_DATA;
    if (!novel || !novel.chapters) return;

    // Match measureBox dimensions to actual bookViewport
    const rect = el.bookViewport.getBoundingClientRect();
    const width = rect.width || Math.min(540, window.innerWidth);
    const height = rect.height || window.innerHeight;

    el.measureBox.style.width = width + 'px';
    el.measureBox.style.height = height + 'px';

    const pages = [];
    const chapterStartPages = {};

    // Page 0 is always Cover
    pages.push(buildCoverPageObject());

    // Measure available body height inside a standard page
    el.measureBox.innerHTML = `
      <div class="page-header-strip"><span>반추 返追</span><span>제1장</span></div>
      <div class="page-body-content" id="measureBody"></div>
      <div class="page-footer-strip"><span>1장</span><span>1 / 100</span></div>
    `;
    const measureBody = document.getElementById('measureBody');
    const maxBodyHeight = measureBody.clientHeight;

    novel.chapters.forEach((chapter) => {
      chapterStartPages[chapter.id] = pages.length;
      const paras = chapter.paragraphs;
      let pIdx = 0;
      let isFirstPageOfChapter = true;

      while (pIdx < paras.length) {
        measureBody.innerHTML = '';
        const startParaIndex = pIdx;
        const pageParas = [];

        if (isFirstPageOfChapter) {
          const opener = document.createElement('div');
          opener.className = 'chapter-opener';
          opener.innerHTML = `
            <span class="chapter-opener-num">${chapter.number}</span>
            <h2 class="chapter-opener-title">${chapter.subtitle}</h2>
          `;
          measureBody.appendChild(opener);
        }

        while (pIdx < paras.length) {
          const pEl = document.createElement('p');
          pEl.className = 'novel-para';
          pEl.textContent = paras[pIdx];
          measureBody.appendChild(pEl);

          // Check if adding this paragraph overflows the page body
          if (measureBody.scrollHeight > maxBodyHeight && pageParas.length > 0) {
            measureBody.removeChild(pEl);
            break;
          } else {
            pageParas.push(paras[pIdx]);
            pIdx++;
            if (measureBody.scrollHeight > maxBodyHeight) {
              // Single oversized paragraph: keep it and move on
              break;
            }
          }
        }

        const endParaIndex = pIdx - 1;
        const openerHtml = isFirstPageOfChapter
          ? `<div class="chapter-opener">
               <span class="chapter-opener-num">${chapter.number}</span>
               <h2 class="chapter-opener-title">${chapter.subtitle}</h2>
             </div>`
          : '';

        const parasHtml = pageParas
          .map((text) => `<p class="novel-para">${escapeHtml(text)}</p>`)
          .join('');

        pages.push({
          type: 'content',
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          chapterSubtitle: chapter.subtitle,
          chapterTitle: chapter.fullTitle,
          startParaIndex,
          endParaIndex,
          snippet: pageParas[0] ? pageParas[0].slice(0, 68) : chapter.fullTitle,
          bodyInnerHtml: openerHtml + parasHtml
        });

        isFirstPageOfChapter = false;
      }
    });

    state.pages = pages;
    state.chapterStartPages = chapterStartPages;
    el.pageSlider.max = Math.max(0, pages.length - 1);
  }

  function buildFullPageHtml(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page) return '';
    if (page.type === 'cover') {
      return page.html;
    }
    const totalContentPages = state.pages.length - 1;
    const progressPct = Math.round((pageIndex / totalContentPages) * 100);
    return `
      <div class="page-header-strip">
        <span>반추 返追</span>
        <span>${escapeHtml(page.chapterTitle)}</span>
      </div>
      <div class="page-body-content">
        ${page.bodyInnerHtml}
      </div>
      <div class="page-footer-strip">
        <span>${progressPct}% 읽음</span>
        <span>${pageIndex} / ${totalContentPages}</span>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // 3. Rendering & 3D Flip Animation
  // =========================================================================
  function renderCurrentPage() {
    const idx = state.currentPageIndex;
    const page = state.pages[idx];
    if (!page) return;

    el.currentPage.innerHTML = buildFullPageHtml(idx);

    // Wire "책 펼치기" CTA button if on Cover Page
    const openBtn = el.currentPage.querySelector('[data-action="open-first-chapter"]');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        turnToPage(1, 'forward');
      });
    }

    updateBarsAndIndicators();
    saveReadingProgress();
  }

  function updateBarsAndIndicators() {
    const idx = state.currentPageIndex;
    const page = state.pages[idx];
    if (!page) return;

    const totalContentPages = Math.max(1, state.pages.length - 1);
    el.topChapterLabel.textContent = page.chapterTitle;
    el.bottomChapterInfo.textContent = page.type === 'cover' ? '표지 · 책 펼치기' : page.chapterTitle;
    el.bottomPageCounter.textContent = page.type === 'cover'
      ? `표지 (총 ${totalContentPages}쪽)`
      : `${idx} / ${totalContentPages}쪽`;
    el.pageSlider.value = idx;

    // Check Bookmark Status
    const isMarked = isPageBookmarked(idx);
    el.btnBookmarkPage.classList.toggle('active', isMarked);
    el.pageRibbon.classList.toggle('hidden', !isMarked);

    // Highlight active chapter in TOC
    document.querySelectorAll('.toc-item').forEach((item) => {
      const cid = Number(item.getAttribute('data-chapter-id'));
      item.classList.toggle('active', cid === page.chapterId);
    });
  }

  function turnToPage(targetIndex, directionOverride, onCompleteCallback) {
    if (state.isFlipping) return;
    const clamped = Math.max(0, Math.min(state.pages.length - 1, targetIndex));
    if (clamped === state.currentPageIndex) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    const direction = directionOverride || (clamped > state.currentPageIndex ? 'forward' : 'backward');

    // If user manually turns page while TTS is active (and not triggered by TTS auto-advance), restart TTS on new page
    const isManualTurnDuringTts = !onCompleteCallback && state.ttsStatus === 'playing';
    if (isManualTurnDuringTts) {
      cancelSpeechInternal();
    }

    const oldHtml = buildFullPageHtml(state.currentPageIndex);
    const newHtml = buildFullPageHtml(clamped);

    state.isFlipping = true;

    el.flipCard.classList.remove('anim-forward', 'anim-backward');
    el.flipLayer.classList.remove('hidden');

    if (direction === 'forward') {
      // Underlying static page becomes the destination page immediately
      state.currentPageIndex = clamped;
      el.currentPage.innerHTML = newHtml;
      el.flipFront.innerHTML = `<div class="book-page">${oldHtml}</div>`;
      el.flipBack.innerHTML = `<div class="book-page"></div>`;
      void el.flipCard.offsetWidth; // Force reflow
      el.flipCard.classList.add('anim-forward');
    } else {
      // Backward flip: underlying static page stays old until animation completes
      el.flipFront.innerHTML = `<div class="book-page">${newHtml}</div>`;
      el.flipBack.innerHTML = `<div class="book-page"></div>`;
      void el.flipCard.offsetWidth;
      el.flipCard.classList.add('anim-backward');
      state.currentPageIndex = clamped;
    }

    updateBarsAndIndicators();
    saveReadingProgress();

    setTimeout(() => {
      renderCurrentPage();
      el.flipLayer.classList.add('hidden');
      el.flipCard.classList.remove('anim-forward', 'anim-backward');
      state.isFlipping = false;
      if (onCompleteCallback) {
        onCompleteCallback();
      } else if (isManualTurnDuringTts) {
        state.ttsParaOffset = 0;
        speakCurrentParagraph();
      }
    }, 520);
  }

  function nextPage() {
    if (state.currentPageIndex < state.pages.length - 1) {
      turnToPage(state.currentPageIndex + 1, 'forward');
    }
  }

  function prevPage() {
    if (state.currentPageIndex > 0) {
      turnToPage(state.currentPageIndex - 1, 'backward');
    }
  }

  // =========================================================================
  // 4. Scroll Mode Support (Instant Focus Switch)
  // =========================================================================
  function renderScrollModeContent() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;
    const htmlParts = [];

    novel.chapters.forEach((chap) => {
      const paras = chap.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      htmlParts.push(`
        <section class="scroll-chapter-block" id="scroll-chap-${chap.id}" data-chapter-id="${chap.id}">
          <div class="chapter-opener">
            <span class="chapter-opener-num">${chap.number}</span>
            <h2 class="chapter-opener-title">${chap.subtitle}</h2>
          </div>
          ${paras}
        </section>
      `);
    });

    el.scrollContent.innerHTML = htmlParts.join('');
  }

  function updateModeView() {
    if (state.mode === 'scroll') {
      el.bookViewport.style.display = 'none';
      el.scrollViewport.classList.remove('hidden');
      el.modeIcon.textContent = '📜';
      el.modeText.textContent = '스크롤 모드';
      if (!el.scrollContent.innerHTML.trim()) {
        renderScrollModeContent();
      }
      // Scroll to current chapter
      const curPage = state.pages[state.currentPageIndex];
      if (curPage && curPage.chapterId > 0) {
        const chapNode = document.getElementById(`scroll-chap-${curPage.chapterId}`);
        if (chapNode) chapNode.scrollIntoView({ behavior: 'instant' });
      }
    } else {
      el.scrollViewport.classList.add('hidden');
      el.bookViewport.style.display = 'block';
      el.modeIcon.textContent = '📖';
      el.modeText.textContent = '3D 책넘김';
      paginateNovel();
      renderCurrentPage();
    }
  }

  // =========================================================================
  // 5. Table of Contents & Bookmarks
  // =========================================================================
  function renderTocList() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;

    const items = [];
    // Cover entry
    items.push(`
      <li class="toc-item ${state.currentPageIndex === 0 ? 'active' : ''}" data-chapter-id="0" data-target-page="0">
        <div class="toc-item-left">
          <span class="toc-chap-num">COVER</span>
          <span class="toc-chap-title">표지 — 반추 (返追)</span>
        </div>
        <span class="toc-page-num">표지</span>
      </li>
    `);

    novel.chapters.forEach((chap) => {
      const startPage = state.chapterStartPages[chap.id] || 1;
      items.push(`
        <li class="toc-item" data-chapter-id="${chap.id}" data-target-page="${startPage}">
          <div class="toc-item-left">
            <span class="toc-chap-num">${chap.number}</span>
            <span class="toc-chap-title">${chap.subtitle}</span>
          </div>
          <span class="toc-page-num">${startPage}쪽</span>
        </li>
      `);
    });

    el.tocList.innerHTML = items.join('');
    el.tocList.querySelectorAll('.toc-item').forEach((li) => {
      li.addEventListener('click', () => {
        const targetPage = Number(li.getAttribute('data-target-page'));
        const chapId = Number(li.getAttribute('data-chapter-id'));
        closeDrawers();
        if (state.mode === 'scroll') {
          if (chapId === 0) {
            el.scrollViewport.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            const node = document.getElementById(`scroll-chap-${chapId}`);
            if (node) node.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          turnToPage(targetPage);
        }
      });
    });
  }

  function isPageBookmarked(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page || page.type === 'cover') return false;
    return state.bookmarks.some(
      (b) => b.chapterId === page.chapterId &&
             b.paraIndex >= page.startParaIndex &&
             b.paraIndex <= page.endParaIndex
    );
  }

  function toggleCurrentPageBookmark() {
    const idx = state.currentPageIndex;
    const page = state.pages[idx];
    if (!page || page.type === 'cover') return;

    const existingIndex = state.bookmarks.findIndex(
      (b) => b.chapterId === page.chapterId &&
             b.paraIndex >= page.startParaIndex &&
             b.paraIndex <= page.endParaIndex
    );

    if (existingIndex >= 0) {
      state.bookmarks.splice(existingIndex, 1);
    } else {
      state.bookmarks.unshift({
        chapterId: page.chapterId,
        paraIndex: page.startParaIndex,
        chapterTitle: page.chapterTitle,
        snippet: page.snippet,
        savedAt: new Date().toLocaleDateString('ko-KR')
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(state.bookmarks));
    } catch (e) {}

    renderBookmarkList();
    updateBarsAndIndicators();
  }

  function findPageForParagraph(chapterId, paraIndex) {
    for (let i = 1; i < state.pages.length; i++) {
      const p = state.pages[i];
      if (p.chapterId === chapterId && paraIndex >= p.startParaIndex && paraIndex <= p.endParaIndex) {
        return i;
      }
    }
    return state.chapterStartPages[chapterId] || 1;
  }

  function renderBookmarkList() {
    el.bookmarkCountBadge.textContent = String(state.bookmarks.length);
    if (state.bookmarks.length === 0) {
      el.bookmarkList.innerHTML = '';
      el.bookmarkEmptyState.classList.remove('hidden');
      return;
    }
    el.bookmarkEmptyState.classList.add('hidden');
    el.bookmarkList.innerHTML = state.bookmarks.map((bm, i) => {
      const pageNum = findPageForParagraph(bm.chapterId, bm.paraIndex);
      return `
        <li class="bookmark-item" data-bm-index="${i}" data-target-page="${pageNum}">
          <div class="bookmark-item-top">
            <span>🔖 ${escapeHtml(bm.chapterTitle)}</span>
            <span>${pageNum}쪽 · ${bm.savedAt}</span>
          </div>
          <p class="bookmark-snippet">${escapeHtml(bm.snippet)}…</p>
        </li>
      `;
    }).join('');

    el.bookmarkList.querySelectorAll('.bookmark-item').forEach((li) => {
      li.addEventListener('click', () => {
        const targetPage = Number(li.getAttribute('data-target-page'));
        closeDrawers();
        turnToPage(targetPage);
      });
    });
  }

  // =========================================================================
  // 5B. TTS Audiobook Engine (Soft Male Voice, Auto Page Flip, Play/Pause/Stop)
  // =========================================================================
  const synth = window.speechSynthesis || null;
  let cachedMaleVoice = null;
  let currentUtterance = null;
  let ttsCancelFlag = false;

  function selectBestKoreanMaleVoice() {
    if (!synth) return null;
    const voices = synth.getVoices() || [];
    const koVoices = voices.filter((v) => v.lang && (v.lang.toLowerCase().includes('ko') || v.name.includes('한국어') || v.name.includes('Korean')));
    if (koVoices.length === 0) return null;

    // Priority 1: Natural / Neural Male Korean voices (e.g., Microsoft InJoon Online Natural, Google/Apple Male)
    const maleKeywords = ['injoon', '인준', 'hyunsu', '현수', 'bongjin', '봉진', 'gookmin', '국민', 'male', '남성', '민수', '태민', 'yuna-male'];
    for (const kw of maleKeywords) {
      const found = koVoices.find((v) => v.name.toLowerCase().includes(kw));
      if (found) return found;
    }

    // Priority 2: High-quality Online/Natural Korean voice (we tune pitch to warm male baritone if needed)
    const naturalVoice = koVoices.find((v) => v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.includes('Google'));
    return naturalVoice || koVoices[0];
  }

  function isLikelyMaleVoice(voice) {
    if (!voice) return false;
    const n = voice.name.toLowerCase();
    return ['injoon', '인준', 'hyunsu', '현수', 'bongjin', '봉진', 'gookmin', '국민', 'male', '남성'].some((kw) => n.includes(kw));
  }

  if (synth && typeof synth.onvoiceschanged !== 'undefined') {
    synth.onvoiceschanged = () => {
      cachedMaleVoice = selectBestKoreanMaleVoice();
    };
  }

  function clearTtsHighlight() {
    document.querySelectorAll('.tts-reading-active').forEach((node) => {
      node.classList.remove('tts-reading-active');
    });
  }

  function highlightCurrentParagraph(offset) {
    clearTtsHighlight();
    const paraNodes = el.currentPage.querySelectorAll('p.novel-para');
    if (paraNodes && paraNodes[offset]) {
      paraNodes[offset].classList.add('tts-reading-active');
    }
  }

  function updateTtsUi() {
    const isPlaying = state.ttsStatus === 'playing';
    const isPaused = state.ttsStatus === 'paused';

    el.btnOpenTts.classList.toggle('active', isPlaying || isPaused);
    el.ttsWaveDot.classList.toggle('speaking', isPlaying);
    el.ttsPlayIcon.textContent = isPlaying ? '⏸' : '▶';
    el.btnTtsSpeed.textContent = state.ttsRate.toFixed(1) + 'x';

    const page = state.pages[state.currentPageIndex];
    const chapLabel = page && page.type !== 'cover' ? page.chapterNumber : '1장';
    if (isPlaying) {
      el.ttsStatusText.textContent = `${chapLabel} 낭독 중 (${state.currentPageIndex}쪽)`;
    } else if (isPaused) {
      el.ttsStatusText.textContent = `일시정지됨 (${state.currentPageIndex}쪽)`;
    } else {
      el.ttsStatusText.textContent = `낭독 대기 (${state.currentPageIndex || 1}쪽)`;
    }
  }

  function cancelSpeechInternal() {
    ttsCancelFlag = true;
    if (synth) {
      synth.cancel();
    }
    currentUtterance = null;
  }

  function speakCurrentParagraph() {
    if (!synth) {
      alert('이 브라우저는 음성 낭독(TTS)을 지원하지 않습니다.');
      return;
    }

    // If on Cover Page (0), automatically flip to Page 1 first
    if (state.currentPageIndex === 0) {
      state.ttsStatus = 'playing';
      state.ttsParaOffset = 0;
      updateTtsUi();
      turnToPage(1, 'forward', () => {
        if (state.ttsStatus === 'playing') {
          speakCurrentParagraph();
        }
      });
      return;
    }

    const page = state.pages[state.currentPageIndex];
    if (!page || page.type === 'cover') return;

    const paraNodes = el.currentPage.querySelectorAll('p.novel-para');
    const totalParasOnPage = paraNodes.length;

    // If all paragraphs on the current page have been read, auto-flip to next page!
    if (state.ttsParaOffset >= totalParasOnPage) {
      clearTtsHighlight();
      if (state.currentPageIndex < state.pages.length - 1) {
        state.ttsParaOffset = 0;
        turnToPage(state.currentPageIndex + 1, 'forward', () => {
          if (state.ttsStatus === 'playing') {
            speakCurrentParagraph();
          }
        });
      } else {
        // Reached the end of the entire novel
        stopTts();
        el.ttsStatusText.textContent = '완독 완료';
      }
      return;
    }

    const targetNode = paraNodes[state.ttsParaOffset];
    const textToRead = targetNode ? targetNode.textContent.trim() : '';
    if (!textToRead) {
      state.ttsParaOffset++;
      speakCurrentParagraph();
      return;
    }

    cancelSpeechInternal();
    ttsCancelFlag = false;

    // Prefix chapter title naturally if it's the very first paragraph of a chapter
    let spokenText = textToRead;
    if (state.ttsParaOffset === 0 && page.startParaIndex === 0) {
      spokenText = `${page.chapterTitle}. ${textToRead}`;
    }

    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.lang = 'ko-KR';
    cachedMaleVoice = cachedMaleVoice || selectBestKoreanMaleVoice();
    if (cachedMaleVoice) {
      utter.voice = cachedMaleVoice;
    }

    // Tune for a soft, warm, calm male storytelling voice:
    // If a dedicated male voice (like Microsoft InJoon) is active, use natural warm pitch (0.94).
    // If only a default/female voice is installed on the device, lower pitch (0.78) to create a gentle male tone.
    const hasNativeMale = isLikelyMaleVoice(cachedMaleVoice);
    utter.pitch = hasNativeMale ? 0.94 : 0.78;
    utter.rate = state.ttsRate * 0.95; // Slightly relaxed literary pacing

    highlightCurrentParagraph(state.ttsParaOffset);
    state.ttsStatus = 'playing';
    updateTtsUi();

    utter.onend = () => {
      if (ttsCancelFlag || state.ttsStatus !== 'playing') return;
      state.ttsParaOffset++;
      speakCurrentParagraph();
    };

    utter.onerror = (ev) => {
      if (ttsCancelFlag || ev.error === 'interrupted' || ev.error === 'canceled') return;
      if (state.ttsStatus === 'playing') {
        state.ttsParaOffset++;
        speakCurrentParagraph();
      }
    };

    currentUtterance = utter;
    synth.speak(utter);
  }

  function startOrResumeTts() {
    if (!synth) return;
    el.ttsPlayerBar.classList.remove('hidden');

    if (state.ttsStatus === 'playing') {
      // Pause
      state.ttsStatus = 'paused';
      if (synth.speaking) {
        synth.pause();
      }
      updateTtsUi();
    } else if (state.ttsStatus === 'paused') {
      // Resume
      state.ttsStatus = 'playing';
      if (synth.paused) {
        synth.resume();
        updateTtsUi();
      } else {
        // Fallback if browser cleared paused utterance (common on mobile Safari/Chrome)
        speakCurrentParagraph();
      }
    } else {
      // Stopped -> Start from beginning of current page (or clicked paragraph)
      state.ttsStatus = 'playing';
      speakCurrentParagraph();
    }
  }

  function stopTts() {
    cancelSpeechInternal();
    state.ttsStatus = 'stopped';
    state.ttsParaOffset = 0;
    clearTtsHighlight();
    updateTtsUi();
  }

  function cycleTtsSpeed() {
    const speeds = [0.9, 1.0, 1.1, 1.25];
    const idx = speeds.findIndex((s) => Math.abs(s - state.ttsRate) < 0.03);
    state.ttsRate = speeds[(idx + 1) % speeds.length];
    updateTtsUi();
    if (state.ttsStatus === 'playing') {
      speakCurrentParagraph();
    }
  }

  // =========================================================================
  // 6. Ambient Starfield Canvas Animation
  // =========================================================================
  function initStarfield() {
    const canvas = el.starCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];

    function resizeStarCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.floor((canvas.width * canvas.height) / 14000);
      stars = Array.from({ length: Math.min(90, Math.max(30, count)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.018 + 0.005
      }));
    }

    resizeStarCanvas();
    window.addEventListener('resize', resizeStarCanvas);

    function drawStars() {
      if (state.theme === 'starlight') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stars) {
          s.phase += s.speed;
          const alpha = 0.25 + 0.55 * Math.sin(s.phase);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(229, 192, 123, ${Math.max(0.08, alpha)})`;
          ctx.fill();
        }
      }
      requestAnimationFrame(drawStars);
    }
    requestAnimationFrame(drawStars);
  }

  // =========================================================================
  // 7. UI Events, Touch Swipe, Keyboard & Resize Handling
  // =========================================================================
  function toggleUiBars(forceState) {
    state.uiVisible = typeof forceState === 'boolean' ? forceState : !state.uiVisible;
    el.topBar.classList.toggle('visible', state.uiVisible);
    el.bottomBar.classList.toggle('visible', state.uiVisible);
  }

  function closeDrawers() {
    el.tocDrawer.classList.add('hidden');
    el.settingsPanel.classList.add('hidden');
    el.drawerBackdrop.classList.add('hidden');
  }

  function checkSavedProgressToast() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.chapterId) return;

      const targetPage = findPageForParagraph(saved.chapterId, saved.paraIndex || 0);
      if (targetPage > 1) {
        el.resumeToastMsg.textContent = `${saved.chapterTitle} (${targetPage}쪽) 이어 읽기`;
        el.resumeToast.classList.remove('hidden');

        el.btnResumeYes.onclick = () => {
          el.resumeToast.classList.add('hidden');
          turnToPage(targetPage, 'forward');
        };
        el.btnResumeClose.onclick = () => {
          el.resumeToast.classList.add('hidden');
        };
        setTimeout(() => {
          el.resumeToast.classList.add('hidden');
        }, 8000);
      }
    } catch (e) {}
  }

  function preservePositionAndRepaginate() {
    const curPage = state.pages[state.currentPageIndex];
    const chapId = curPage ? curPage.chapterId : 0;
    const paraIdx = curPage ? curPage.startParaIndex : 0;

    paginateNovel();
    renderTocList();
    renderBookmarkList();

    if (chapId === 0) {
      state.currentPageIndex = 0;
    } else {
      state.currentPageIndex = findPageForParagraph(chapId, paraIdx);
    }
    renderCurrentPage();
  }

  function bindEvents() {
    // Touch/Click Zones
    el.zonePrev.addEventListener('click', () => {
      prevPage();
    });
    el.zoneNext.addEventListener('click', () => {
      nextPage();
    });
    el.zoneCenter.addEventListener('click', () => {
      toggleUiBars();
    });

    // Touch Swipe Gesture Support on Book Viewport
    let touchStartX = 0;
    let touchStartY = 0;
    el.bookViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    el.bookViewport.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          if (dx < 0) nextPage();
          else prevPage();
        }
      }
    }, { passive: true });

    // Bottom Bar Controls
    el.btnPrevPage.addEventListener('click', prevPage);
    el.btnNextPage.addEventListener('click', nextPage);
    el.pageSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      const page = state.pages[val];
      if (page) {
        el.bottomPageCounter.textContent = val === 0 ? '표지' : `${val} / ${state.pages.length - 1}쪽`;
        el.bottomChapterInfo.textContent = page.chapterTitle;
      }
    });
    el.pageSlider.addEventListener('change', (e) => {
      turnToPage(Number(e.target.value));
    });

    // Keyboard Navigation
    window.addEventListener('keydown', (e) => {
      if (state.mode !== 'flip') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevPage();
      } else if (e.key === 'Escape') {
        closeDrawers();
      }
    });

    // TOC & Bookmarks Drawer
    el.btnOpenToc.addEventListener('click', () => {
      renderTocList();
      renderBookmarkList();
      el.settingsPanel.classList.add('hidden');
      el.tocDrawer.classList.remove('hidden');
      el.drawerBackdrop.classList.remove('hidden');
    });
    el.btnCloseToc.addEventListener('click', closeDrawers);
    el.drawerBackdrop.addEventListener('click', closeDrawers);

    el.tabBtnToc.addEventListener('click', () => {
      el.tabBtnToc.classList.add('active');
      el.tabBtnBookmarks.classList.remove('active');
      el.tabPanelToc.classList.remove('hidden');
      el.tabPanelBookmarks.classList.add('hidden');
    });
    el.tabBtnBookmarks.addEventListener('click', () => {
      el.tabBtnBookmarks.classList.add('active');
      el.tabBtnToc.classList.remove('active');
      el.tabPanelBookmarks.classList.remove('hidden');
      el.tabPanelToc.classList.add('hidden');
    });

    // Bookmark Toggle
    el.btnBookmarkPage.addEventListener('click', toggleCurrentPageBookmark);

    // Settings Sheet
    el.btnOpenSettings.addEventListener('click', () => {
      el.tocDrawer.classList.add('hidden');
      el.settingsPanel.classList.toggle('hidden');
      el.drawerBackdrop.classList.toggle('hidden', el.settingsPanel.classList.contains('hidden'));
    });
    el.btnCloseSettings.addEventListener('click', closeDrawers);

    // Theme Selection
    document.querySelectorAll('[data-theme-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.theme = btn.getAttribute('data-theme-select');
        applyVisualSettings();
        saveSettings();
      });
    });

    // Font Family Selection
    document.querySelectorAll('[data-font-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.fontKey = btn.getAttribute('data-font-select');
        applyVisualSettings();
        saveSettings();
        preservePositionAndRepaginate();
      });
    });

    // Font Size Stepper
    el.btnFontDec.addEventListener('click', () => {
      if (state.fontSize > 14) {
        state.fontSize -= 1;
        applyVisualSettings();
        saveSettings();
        preservePositionAndRepaginate();
      }
    });
    el.btnFontInc.addEventListener('click', () => {
      if (state.fontSize < 26) {
        state.fontSize += 1;
        applyVisualSettings();
        saveSettings();
        preservePositionAndRepaginate();
      }
    });

    // Line Height Stepper
    el.btnLineDec.addEventListener('click', () => {
      if (state.lineHeight > 1.55) {
        state.lineHeight = Number((state.lineHeight - 0.1).toFixed(2));
        applyVisualSettings();
        saveSettings();
        preservePositionAndRepaginate();
      }
    });
    el.btnLineInc.addEventListener('click', () => {
      if (state.lineHeight < 2.35) {
        state.lineHeight = Number((state.lineHeight + 0.1).toFixed(2));
        applyVisualSettings();
        saveSettings();
        preservePositionAndRepaginate();
      }
    });

    // Mode Toggle (3D Flip <-> Scroll)
    el.btnToggleMode.addEventListener('click', () => {
      state.mode = state.mode === 'flip' ? 'scroll' : 'flip';
      saveSettings();
      updateModeView();
    });

    // TTS Audiobook Controls
    el.btnOpenTts.addEventListener('click', () => {
      if (el.ttsPlayerBar.classList.contains('hidden')) {
        el.ttsPlayerBar.classList.remove('hidden');
        if (state.ttsStatus !== 'playing') {
          startOrResumeTts();
        }
      } else {
        startOrResumeTts();
      }
    });
    el.btnTtsPlayPause.addEventListener('click', startOrResumeTts);
    el.btnTtsStop.addEventListener('click', stopTts);
    el.btnTtsSpeed.addEventListener('click', cycleTtsSpeed);
    el.btnTtsClose.addEventListener('click', () => {
      stopTts();
      el.ttsPlayerBar.classList.add('hidden');
    });

    // Clean up speech if tab/window is closed
    window.addEventListener('beforeunload', () => {
      cancelSpeechInternal();
    });

    // Responsive Window Resize Repagination
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.mode === 'flip') {
          preservePositionAndRepaginate();
        }
      }, 220);
    });
  }

  // =========================================================================
  // 9. Initialization
  // =========================================================================
  function init() {
    loadSavedSettings();
    applyVisualSettings();
    initStarfield();
    paginateNovel();
    renderTocList();
    renderBookmarkList();
    renderCurrentPage();
    if (state.mode === 'scroll') {
      updateModeView();
    }
    bindEvents();
    checkSavedProgressToast();

    // Ensure accurate pagination once web fonts finish loading
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (state.mode === 'flip') {
          preservePositionAndRepaginate();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

