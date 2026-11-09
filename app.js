/**
 * 『반추 (返追)』 — 3D Flip Mobile & Focus Web-Book Engine (v2, Literary Night Edition)
 *
 * Page model: state.pages = [cover, (chapter, content...)×8, credits]
 *   type: 'cover' | 'chapter' | 'content' | 'credits'
 *   Only 'content' pages carry a folio number (pageNo) and reading progress.
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
    starlight: '#04060d',
    sepia: '#2e2520',
    paper: '#e6e8ee',
    dawn: '#2b2a3b'
  };

  // Ending credits (작가의 말) — shown as the final page after Chapter 8. Edit freely.
  const CREDITS_CHAPTER_ID = 99;
  const AFTERWORD_PARAS = [
    '이 이야기는 한 사람이 어떤 대답을 기다리다가, 기다림 그 자체를 내려놓기까지의 기록입니다.',
    '별이 지고 난 뒤에도 하늘은 그 자리에 남아 있듯, 누군가를 좋아했던 마음은 돌려받지 못해도 사라지지 않습니다. 다만 그 마음이 하루를 전부 차지하지 않게 되는 날이 올 뿐입니다.',
    '연못가의 노인과 별 수집가, 시계공과 사서, 그리고 끝내 함께 데려오기로 한 그림자에게. 오래 머물러 주어 고맙습니다.',
    '그리고 여기까지 읽어 주신 당신에게도.'
  ];

  // Line-art motif per chapter (64×64, stroke = currentColor). Used on chapter title pages, TOC and scroll mode.
  const CHAPTER_MOTIFS = {
    1: `<svg viewBox="0 0 64 64"><circle cx="32" cy="15" r="2.4" fill="currentColor" stroke="none"/><path d="M32 7v3.5M32 19.5V23M24 15h3.5M36.5 15H40"/><path d="M32 26v14" stroke-dasharray="1.5 3"/><ellipse cx="32" cy="47" rx="21" ry="6.5"/><ellipse cx="32" cy="47" rx="10" ry="3"/></svg>`,
    2: `<svg viewBox="0 0 64 64"><path d="M12 12l15 15"/><path d="M33 9l11 11"/><path d="M20 34l17 17"/><circle cx="29.5" cy="29.5" r="2.1" fill="currentColor" stroke="none"/><circle cx="46" cy="22" r="1.7" fill="currentColor" stroke="none"/><circle cx="39.5" cy="53.5" r="2.3" fill="currentColor" stroke="none"/></svg>`,
    3: `<svg viewBox="0 0 64 64"><circle cx="32" cy="37" r="18"/><circle cx="32" cy="37" r="13.5"/><path d="M32 37V27.5M32 37l6.5 4.5"/><path d="M28.5 13h7M32 13v6"/><circle cx="32" cy="37" r="1.3" fill="currentColor" stroke="none"/></svg>`,
    4: `<svg viewBox="0 0 64 64"><path d="M32 51V27"/><path d="M32 27c-9 0-14.5-6-14.5-12.5 0-5 5-8 9.5-6 1-5.5 9-5.5 10 0 4.5-2 9.5 1 9.5 6C46.5 21 41 27 32 27z"/><path d="M16 53h32"/><path d="M34 53c7 2 13 5.5 17 10" opacity=".5"/></svg>`,
    5: `<svg viewBox="0 0 64 64"><path d="M32 57V35"/><path d="M32 35c0-8.5-8-13-16.5-15"/><path d="M32 35c0-8.5 8-13 16.5-15"/><circle cx="13.5" cy="18.5" r="2.6"/><circle cx="50.5" cy="18.5" r="2.6"/><path d="M25 57h14"/></svg>`,
    6: `<svg viewBox="0 0 64 64"><path d="M32 11c6.5 6.5 9.5 13.5 9.5 21 0 8.5-4 14.5-9.5 21-5.5-6.5-9.5-12.5-9.5-21 0-7.5 3-14.5 9.5-21z"/><path d="M32 18v30" opacity=".45"/><path d="M22.5 31l-6.5-4.5M41.5 31l6.5-4.5" opacity=".55"/></svg>`,
    7: `<svg viewBox="0 0 64 64"><path d="M32 19c-6-4-13-5.5-20-4.5v32c7-1 14 .5 20 4.5 6-4 13-5.5 20-4.5v-32c-7-1-14 .5-20 4.5z"/><path d="M32 19v32"/><path d="M18 25c4-.5 8 0 11 1.5M18 33c4-.5 8 0 11 1.5M35 26.5c3-1.5 7-2 11-1.5M35 34.5c3-1.5 7-2 11-1.5" opacity=".55"/></svg>`,
    8: `<svg viewBox="0 0 64 64"><path d="M13 40h38l-6.5 8.5h-25z"/><path d="M32 40V19"/><path d="M32 19l12.5 14.5H32z"/><path d="M9 55c4-3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0" opacity=".55"/></svg>`,
    cover: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="3" fill="currentColor" stroke="none"/><path d="M32 14v8M32 42v8M14 32h8M42 32h8M19.3 19.3l5.7 5.7M39 39l5.7 5.7M44.7 19.3L39 25M25 39l-5.7 5.7"/></svg>`,
    end: `<svg viewBox="0 0 64 64"><circle cx="32" cy="24" r="3" fill="currentColor" stroke="none"/><path d="M32 30v10" stroke-dasharray="1.5 3"/><ellipse cx="32" cy="46" rx="18" ry="5"/><path d="M16 14l4 4M48 14l-4 4" opacity=".5"/></svg>`
  };

  const MODE_ICONS = {
    flip: `<svg viewBox="0 0 24 24"><path d="M3 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/></svg>`,
    scroll: `<svg viewBox="0 0 24 24"><path d="M6 4h12M6 9h12M6 14h9M12 18v-3M9.5 18.5L12 21l2.5-2.5"/></svg>`
  };

  // Reader State
  const state = {
    theme: 'starlight',
    fontKey: 'gowun',
    fontSize: 18,
    lineHeight: 1.95,
    mode: 'flip', // 'flip' | 'scroll'
    pages: [],
    chapterStartPages: {}, // chapterId -> page index of its title page
    contentTotal: 1,       // number of folio-numbered content pages
    currentPageIndex: 0,
    isFlipping: false,
    uiVisible: true,
    bookmarks: [], // { chapterId, paraIndex, chapterTitle, snippet, savedAt }
    ttsStatus: 'stopped', // 'stopped' | 'playing' | 'paused'
    ttsRate: 1.0,
    ttsParaOffset: 0,
    ttsVoiceURI: '' // '' = auto-select best Korean voice
  };

  // DOM
  const $ = (id) => document.getElementById(id);
  const el = {
    html: document.documentElement,
    metaThemeColor: $('metaThemeColor'),
    starCanvas: $('starfieldCanvas'),
    topBar: $('topBar'),
    bottomBar: $('bottomBar'),
    topChapterLabel: $('topChapterLabel'),
    bottomChapterInfo: $('bottomChapterInfo'),
    bottomPageCounter: $('bottomPageCounter'),
    pageSlider: $('pageSlider'),
    bookViewport: $('bookViewport'),
    currentPage: $('currentPage'),
    pageRibbon: $('pageRibbon'),
    flipLayer: $('flipLayer'),
    flipCard: $('flipCard'),
    flipFront: $('flipFront'),
    flipBack: $('flipBack'),
    measureBox: $('measureBox'),
    scrollViewport: $('scrollViewport'),
    scrollContent: $('scrollContent'),
    zonePrev: $('zonePrev'),
    zoneCenter: $('zoneCenter'),
    zoneNext: $('zoneNext'),
    btnPrevPage: $('btnPrevPage'),
    btnNextPage: $('btnNextPage'),
    btnOpenToc: $('btnOpenToc'),
    btnCloseToc: $('btnCloseToc'),
    tocDrawer: $('tocDrawer'),
    drawerBackdrop: $('drawerBackdrop'),
    drawerProgressLabel: $('drawerProgressLabel'),
    drawerProgressFill: $('drawerProgressFill'),
    tabBtnToc: $('tabBtnToc'),
    tabBtnBookmarks: $('tabBtnBookmarks'),
    tabPanelToc: $('tabPanelToc'),
    tabPanelBookmarks: $('tabPanelBookmarks'),
    tocList: $('tocList'),
    bookmarkList: $('bookmarkList'),
    bookmarkEmptyState: $('bookmarkEmptyState'),
    bookmarkCountBadge: $('bookmarkCountBadge'),
    btnBookmarkPage: $('btnBookmarkPage'),
    btnOpenSettings: $('btnOpenSettings'),
    btnCloseSettings: $('btnCloseSettings'),
    settingsPanel: $('settingsPanel'),
    fontSizeVal: $('fontSizeVal'),
    lineHeightVal: $('lineHeightVal'),
    btnFontDec: $('btnFontDec'),
    btnFontInc: $('btnFontInc'),
    btnLineDec: $('btnLineDec'),
    btnLineInc: $('btnLineInc'),
    btnToggleMode: $('btnToggleMode'),
    modeIcon: $('modeIcon'),
    modeText: $('modeText'),
    btnOpenTts: $('btnOpenTts'),
    ttsPlayerBar: $('ttsPlayerBar'),
    ttsWaveDot: $('ttsWaveDot'),
    ttsStatusText: $('ttsStatusText'),
    btnTtsPlayPause: $('btnTtsPlayPause'),
    ttsPlayIcon: $('ttsPlayIcon'),
    btnTtsStop: $('btnTtsStop'),
    btnTtsSpeed: $('btnTtsSpeed'),
    btnTtsClose: $('btnTtsClose'),
    ttsVoiceSelect: $('ttsVoiceSelect'),
    ttsVoiceHint: $('ttsVoiceHint'),
    resumeToast: $('resumeToast'),
    resumeToastMsg: $('resumeToastMsg'),
    btnResumeYes: $('btnResumeYes'),
    btnResumeClose: $('btnResumeClose')
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // 1. Settings & Storage
  // =========================================================================
  function loadSavedSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme && THEME_META_COLOR[parsed.theme]) state.theme = parsed.theme;
        if (parsed.fontKey && FONT_MAP[parsed.fontKey]) state.fontKey = parsed.fontKey;
        if (parsed.fontSize) state.fontSize = Math.min(26, Math.max(14, Number(parsed.fontSize)));
        if (parsed.lineHeight) state.lineHeight = Math.min(2.4, Math.max(1.5, Number(parsed.lineHeight)));
        if (parsed.mode === 'scroll' || parsed.mode === 'flip') state.mode = parsed.mode;
        if (typeof parsed.ttsVoiceURI === 'string') state.ttsVoiceURI = parsed.ttsVoiceURI;
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
        mode: state.mode,
        ttsVoiceURI: state.ttsVoiceURI
      }));
    } catch (e) {}
  }

  function saveReadingProgress() {
    const page = state.pages[state.currentPageIndex];
    if (!page || page.type !== 'content') return;
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
      el.metaThemeColor.setAttribute('content', THEME_META_COLOR[state.theme] || THEME_META_COLOR.starlight);
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
  // 2. Page Builders (cover / chapter / credits) & Auto-Pagination
  // =========================================================================
  function coverStarsSvg() {
    // Deterministic LCG so the sky is identical on every render
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    let out = '';
    for (let i = 0; i < 58; i++) {
      const x = (rnd() * 400).toFixed(1);
      const y = (rnd() * 700).toFixed(1);
      const r = (0.45 + rnd() * 1.25).toFixed(2);
      const cls = i % 3 === 0 ? ' t2' : i % 3 === 1 ? ' t3' : '';
      out += `<circle class="cover-star-bg${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
    }
    return out;
  }

  function buildCoverPageObject() {
    return {
      type: 'cover',
      chapterId: 0,
      chapterTitle: '표지',
      startParaIndex: 0,
      endParaIndex: -1,
      html: `
        <div class="cover">
          <svg class="cover-sky-svg" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="cvSky" x1="0" y1="0" x2="0" y2="1">
                <stop class="cv-sky-a" offset="0"/>
                <stop class="cv-sky-b" offset="1"/>
              </linearGradient>
            </defs>
            <rect width="400" height="700" fill="url(#cvSky)"/>
            ${coverStarsSvg()}
            <line class="cover-shooting" x1="262" y1="330" x2="304" y2="296"/>
          </svg>
          <svg class="cover-pond-svg" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <radialGradient id="cvGlow" cx="50%" cy="60%" r="55%">
                <stop class="cv-glow-a" offset="0"/>
                <stop class="cv-glow-b" offset="1"/>
              </radialGradient>
            </defs>
            <ellipse cx="200" cy="76" rx="210" ry="60" fill="url(#cvGlow)"/>
            <line class="cover-horizon" x1="30" y1="46" x2="370" y2="46"/>
            <ellipse class="cover-pond" cx="200" cy="80" rx="152" ry="27"/>
            <ellipse class="cover-ripple-ring" cx="200" cy="80" rx="60" ry="11"/>
            <ellipse class="cover-ripple-ring r2" cx="200" cy="80" rx="60" ry="11"/>
            <ellipse class="cover-ripple-ring r3" cx="200" cy="80" rx="60" ry="11"/>
            <circle class="cover-orb" cx="200" cy="20" r="4.5"/>
            <ellipse class="cover-orb-reflection" cx="200" cy="80" rx="9" ry="3"/>
          </svg>
          <div class="cover-frame-line" aria-hidden="true"></div>

          <div class="cover-content">
            <div class="cover-head">
              <span class="cover-rule"></span>
              <h1 class="cover-title">반추</h1>
              <span class="cover-hanja">返 追</span>
            </div>

            <div class="cover-spacer"></div>

            <p class="cover-epigraph">
              <span class="epigraph-line">“가끔 길을 잃는 별들이 있어요.</span>
              <span class="epigraph-line epigraph-gap">여기는 잊지 못한 사람들이</span>
              <span class="epigraph-line">오는 곳이니까요.”</span>
            </p>

            <div class="cover-foot">
              <button type="button" class="btn-open-book" data-action="open-first-chapter">책 펼치기 →</button>
              <span class="cover-date-meta">2026. 11. 9. 작성.</span>
            </div>
          </div>
        </div>
      `
    };
  }

  function chapterHeadHtml(chapter) {
    const motif = CHAPTER_MOTIFS[chapter.id] || CHAPTER_MOTIFS.cover;
    const chars = chapter.paragraphs.reduce((n, p) => n + p.length, 0);
    const minutes = Math.max(1, Math.round(chars / 500)); // ~500자/분 literary pace
    return `
      <div class="chapter-motif">${motif}</div>
      <span class="chapter-kicker">${escapeHtml(chapter.number)}</span>
      <h2 class="chapter-heading">${escapeHtml(chapter.subtitle)}</h2>
      <span class="chapter-rule"></span>
      <span class="chapter-paracount">약 ${minutes}분</span>
    `;
  }

  function buildChapterPageObject(chapter) {
    return {
      type: 'chapter',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterSubtitle: chapter.subtitle,
      chapterTitle: chapter.fullTitle,
      startParaIndex: 0,
      endParaIndex: -1,
      html: `
        <div class="chapter-page">
          <span class="chapter-bignum" aria-hidden="true">${String(chapter.id).padStart(2, '0')}</span>
          <div class="chapter-page-inner">${chapterHeadHtml(chapter)}</div>
        </div>
      `
    };
  }

  function creditsInnerHtml(withButton) {
    const paras = AFTERWORD_PARAS.map((t) => `<p>${escapeHtml(t)}</p>`).join('');
    return `
      <div class="credits-top">
        <span class="credits-end-mark">끝</span>
        <div class="credits-star-wrap"><span class="credits-star"></span></div>
        <h2 class="credits-title">작가의 말</h2>
      </div>
      <div class="credits-body">${paras}</div>
      <div class="credits-bottom">
        <span class="credits-sign">반추 返追 · 2026. 11. 9.</span>
        ${withButton ? '<button type="button" class="btn-open-book btn-back-cover" data-action="back-to-cover">처음으로 돌아가기</button>' : ''}
      </div>
    `;
  }

  function buildCreditsPageObject() {
    return {
      type: 'credits',
      chapterId: CREDITS_CHAPTER_ID,
      chapterTitle: '작가의 말',
      startParaIndex: 0,
      endParaIndex: -1,
      html: `<div class="credits-page">${creditsInnerHtml(true)}</div>`
    };
  }

  function contentHeaderHtml(chapterTitle) {
    return `<div class="page-header-strip"><span class="rh-left">반추 返追</span><span class="rh-right">${escapeHtml(chapterTitle)}</span></div>`;
  }

  function contentFooterHtml(pageNo) {
    return `<div class="page-footer-strip"><span>${pageNo}</span></div>`;
  }

  function paginateNovel() {
    const novel = window.NOVEL_DATA;
    if (!novel || !novel.chapters) return;

    // Match measureBox dimensions to the live viewport
    const rect = el.bookViewport.getBoundingClientRect();
    const width = rect.width || Math.min(540, window.innerWidth);
    const height = rect.height || window.innerHeight;
    el.measureBox.style.width = width + 'px';
    el.measureBox.style.height = height + 'px';

    const pages = [];
    const chapterStartPages = {};
    let pageNo = 0;

    pages.push(buildCoverPageObject());

    // Available body height inside a standard content page
    el.measureBox.innerHTML = `${contentHeaderHtml('제1장')}<div class="page-body-content" id="measureBody"></div>${contentFooterHtml(1)}`;
    const measureBody = document.getElementById('measureBody');
    const maxBodyHeight = measureBody.clientHeight;

    novel.chapters.forEach((chapter) => {
      chapterStartPages[chapter.id] = pages.length;
      pages.push(buildChapterPageObject(chapter));

      const paras = chapter.paragraphs;
      let pIdx = 0;
      let isFirstPageOfChapter = true;

      while (pIdx < paras.length) {
        measureBody.innerHTML = '';
        const startParaIndex = pIdx;
        const pageParas = [];

        if (isFirstPageOfChapter) {
          const sink = document.createElement('div');
          sink.className = 'chapter-sink';
          measureBody.appendChild(sink);
        }

        while (pIdx < paras.length) {
          const pEl = document.createElement('p');
          pEl.className = 'novel-para';
          pEl.textContent = paras[pIdx];
          measureBody.appendChild(pEl);

          if (measureBody.scrollHeight > maxBodyHeight && pageParas.length > 0) {
            measureBody.removeChild(pEl);
            break;
          } else {
            pageParas.push(paras[pIdx]);
            pIdx++;
            if (measureBody.scrollHeight > maxBodyHeight) {
              break; // single oversized paragraph: keep it, move on
            }
          }
        }

        pageNo++;
        pages.push({
          type: 'content',
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          chapterSubtitle: chapter.subtitle,
          chapterTitle: chapter.fullTitle,
          startParaIndex,
          endParaIndex: pIdx - 1,
          pageNo,
          snippet: pageParas[0] ? pageParas[0].slice(0, 68) : chapter.fullTitle,
          bodyInnerHtml:
            (isFirstPageOfChapter ? '<div class="chapter-sink"></div>' : '') +
            pageParas.map((text) => `<p class="novel-para">${escapeHtml(text)}</p>`).join('')
        });

        isFirstPageOfChapter = false;
      }
    });

    pages.push(buildCreditsPageObject());

    state.pages = pages;
    state.chapterStartPages = chapterStartPages;
    state.contentTotal = Math.max(1, pageNo);
    el.pageSlider.max = Math.max(0, pages.length - 1);
  }

  function buildFullPageHtml(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page) return '';
    if (page.type !== 'content') return page.html;
    return `
      ${contentHeaderHtml(page.chapterTitle)}
      <div class="page-body-content">${page.bodyInnerHtml}</div>
      ${contentFooterHtml(page.pageNo)}
    `;
  }

  // Folio label for any page (used by bars, slider, TOC, bookmarks, toast)
  function pageLabel(page) {
    if (!page) return '';
    if (page.type === 'cover') return '표지';
    if (page.type === 'credits') return '끝';
    if (page.type === 'chapter') return page.chapterNumber;
    return `${page.pageNo} / ${state.contentTotal}`;
  }

  function readPercent(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page) return 0;
    if (page.type === 'credits') return 100;
    if (page.type === 'content') return Math.round((page.pageNo / state.contentTotal) * 100);
    if (page.type === 'chapter') {
      const next = state.pages[pageIndex + 1];
      return next && next.pageNo ? Math.round(((next.pageNo - 1) / state.contentTotal) * 100) : 0;
    }
    return 0;
  }

  // =========================================================================
  // 3. Rendering & 3D Flip
  // =========================================================================
  function renderCurrentPage() {
    const idx = state.currentPageIndex;
    const page = state.pages[idx];
    if (!page) return;

    el.currentPage.innerHTML = buildFullPageHtml(idx);

    const openBtn = el.currentPage.querySelector('[data-action="open-first-chapter"]');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        turnToPage(1, 'forward');
      });
    }
    const backBtn = el.currentPage.querySelector('[data-action="back-to-cover"]');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        turnToPage(0, 'backward');
      });
    }

    updateBarsAndIndicators();
    saveReadingProgress();
  }

  function setSliderVisual(idx) {
    el.pageSlider.value = idx;
    const pct = state.pages.length > 1 ? (idx / (state.pages.length - 1)) * 100 : 0;
    el.pageSlider.style.setProperty('--progress', pct.toFixed(2) + '%');
  }

  function updateBarsAndIndicators() {
    const idx = state.currentPageIndex;
    const page = state.pages[idx];
    if (!page) return;

    el.topChapterLabel.textContent = page.chapterTitle;
    el.bottomChapterInfo.textContent = page.type === 'cover' ? '표지 · 책 펼치기' : page.chapterTitle;
    el.bottomPageCounter.textContent = page.type === 'cover'
      ? `표지 · 총 ${state.contentTotal}쪽`
      : page.type === 'content' ? `${pageLabel(page)}쪽` : pageLabel(page);
    setSliderVisual(idx);

    const isMarked = isPageBookmarked(idx);
    el.btnBookmarkPage.classList.toggle('active', isMarked);
    el.pageRibbon.classList.toggle('hidden', !isMarked);

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

    // Manual turn while TTS is playing (not a TTS auto-advance): restart reading on the new page
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
      state.currentPageIndex = clamped;
      el.currentPage.innerHTML = newHtml;
      el.flipFront.innerHTML = `<div class="book-page">${oldHtml}</div>`;
      el.flipBack.innerHTML = `<div class="book-page"></div>`;
      void el.flipCard.offsetWidth;
      el.flipCard.classList.add('anim-forward');
    } else {
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
  // 4. Scroll Mode
  // =========================================================================
  function renderScrollModeContent() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;
    const htmlParts = [];

    novel.chapters.forEach((chap) => {
      const paras = chap.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      htmlParts.push(`
        <section class="scroll-chapter-block" id="scroll-chap-${chap.id}" data-chapter-id="${chap.id}">
          <div class="scroll-chapter-head">${chapterHeadHtml(chap)}</div>
          ${paras}
        </section>
      `);
    });

    htmlParts.push(`
      <section class="scroll-credits-block" id="scroll-credits" data-chapter-id="${CREDITS_CHAPTER_ID}">
        ${creditsInnerHtml(false)}
      </section>
    `);

    el.scrollContent.innerHTML = htmlParts.join('');
  }

  function updateModeView() {
    if (state.mode === 'scroll') {
      el.bookViewport.style.display = 'none';
      el.scrollViewport.classList.remove('hidden');
      el.modeIcon.innerHTML = MODE_ICONS.scroll;
      el.modeText.textContent = '스크롤';
      if (!el.scrollContent.innerHTML.trim()) {
        renderScrollModeContent();
      }
      const curPage = state.pages[state.currentPageIndex];
      if (curPage && curPage.chapterId > 0) {
        const nodeId = curPage.chapterId === CREDITS_CHAPTER_ID ? 'scroll-credits' : `scroll-chap-${curPage.chapterId}`;
        const chapNode = document.getElementById(nodeId);
        if (chapNode) chapNode.scrollIntoView({ behavior: 'instant' });
      }
    } else {
      el.scrollViewport.classList.add('hidden');
      el.bookViewport.style.display = 'block';
      el.modeIcon.innerHTML = MODE_ICONS.flip;
      el.modeText.textContent = '책넘김';
      paginateNovel();
      renderCurrentPage();
    }
  }

  // =========================================================================
  // 5. TOC & Bookmarks
  // =========================================================================
  function tocItemHtml({ chapterId, targetPage, motif, num, title, right }) {
    return `
      <li class="toc-item ${state.currentPageIndex === targetPage ? 'active' : ''}" data-chapter-id="${chapterId}" data-target-page="${targetPage}">
        <span class="toc-motif">${motif}</span>
        <div class="toc-item-left">
          <span class="toc-chap-num">${num}</span>
          <span class="toc-chap-title">${escapeHtml(title)}</span>
        </div>
        <span class="toc-page-num">${right}</span>
      </li>
    `;
  }

  function renderTocList() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;

    const items = [];
    items.push(tocItemHtml({ chapterId: 0, targetPage: 0, motif: CHAPTER_MOTIFS.cover, num: 'COVER', title: '표지 — 반추 (返追)', right: '표지' }));

    novel.chapters.forEach((chap) => {
      const startPage = state.chapterStartPages[chap.id] || 1;
      const firstContent = state.pages[startPage + 1];
      const pageNo = firstContent && firstContent.pageNo ? firstContent.pageNo : 1;
      items.push(tocItemHtml({
        chapterId: chap.id,
        targetPage: startPage,
        motif: CHAPTER_MOTIFS[chap.id] || CHAPTER_MOTIFS.cover,
        num: chap.number,
        title: chap.subtitle,
        right: `${pageNo}쪽`
      }));
    });

    items.push(tocItemHtml({ chapterId: CREDITS_CHAPTER_ID, targetPage: state.pages.length - 1, motif: CHAPTER_MOTIFS.end, num: 'EPILOGUE', title: '작가의 말', right: '끝' }));

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
            const nodeId = chapId === CREDITS_CHAPTER_ID ? 'scroll-credits' : `scroll-chap-${chapId}`;
            const node = document.getElementById(nodeId);
            if (node) node.scrollIntoView({ behavior: 'smooth' });
          }
        } else {
          turnToPage(targetPage);
        }
      });
    });

    // Overall progress strip in the drawer header
    const pct = readPercent(state.currentPageIndex);
    el.drawerProgressLabel.textContent = `${pct}% 읽음`;
    el.drawerProgressFill.style.width = pct + '%';
  }

  function isPageBookmarked(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page || page.type !== 'content') return false;
    return state.bookmarks.some(
      (b) => b.chapterId === page.chapterId &&
             b.paraIndex >= page.startParaIndex &&
             b.paraIndex <= page.endParaIndex
    );
  }

  function toggleCurrentPageBookmark() {
    const idx = state.currentPageIndex;
    const page = state.pages[idx];
    if (!page || page.type !== 'content') return;

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

  // Page index that contains (chapterId, paraIndex); falls back to the chapter title page
  function findPageForParagraph(chapterId, paraIndex) {
    for (let i = 1; i < state.pages.length; i++) {
      const p = state.pages[i];
      if (p.type !== 'content') continue;
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
      const pageIdx = findPageForParagraph(bm.chapterId, bm.paraIndex);
      const folio = (state.pages[pageIdx] && state.pages[pageIdx].pageNo) || '';
      return `
        <li class="bookmark-item" data-bm-index="${i}" data-target-page="${pageIdx}">
          <div class="bookmark-item-top">
            <span>${escapeHtml(bm.chapterTitle)}</span>
            <span>${folio ? folio + '쪽 · ' : ''}${bm.savedAt}</span>
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
  // 6. TTS Audiobook Engine
  // =========================================================================
  const synth = window.speechSynthesis || null;
  let cachedMaleVoice = null;
  let currentUtterance = null;

  const MALE_KEYWORDS = ['injoon', '인준', 'hyunsu', '현수', 'bongjin', '봉진', 'gookmin', '국민', 'male', '남성', '민수', '태민'];
  const NEURAL_RE = /natural|online|neural|premium|enhanced|wavenet|studio/i;

  function getKoreanVoices() {
    if (!synth) return [];
    return (synth.getVoices() || []).filter((v) =>
      /^ko/i.test(v.lang || '') || /한국어|korean/i.test(v.name || '')
    );
  }

  function isLikelyMaleVoice(voice) {
    if (!voice) return false;
    const n = voice.name.toLowerCase();
    return MALE_KEYWORDS.some((kw) => n.includes(kw));
  }

  // Higher = better storytelling voice: male first, then neural quality, then online engines
  function scoreVoice(v) {
    const n = v.name.toLowerCase();
    let s = 0;
    if (isLikelyMaleVoice(v)) s += 100;
    if (NEURAL_RE.test(n)) s += 50;
    if (n.includes('google')) s += 20;
    if (v.localService === false) s += 10;
    return s;
  }

  function selectBestKoreanMaleVoice() {
    const ko = getKoreanVoices();
    if (ko.length === 0) return null;
    return ko.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  }

  function resolveTtsVoice() {
    if (state.ttsVoiceURI) {
      const picked = getKoreanVoices().find((v) => v.voiceURI === state.ttsVoiceURI);
      if (picked) return { voice: picked, userPicked: true };
    }
    cachedMaleVoice = cachedMaleVoice || selectBestKoreanMaleVoice();
    return { voice: cachedMaleVoice, userPicked: false };
  }

  function populateVoiceSelect() {
    if (!el.ttsVoiceSelect) return;
    const ko = getKoreanVoices();
    const opts = ['<option value="">자동 선택 (남성 · 자연스러운 음성 우선)</option>'];
    ko.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a)).forEach((v) => {
      const label = v.name
        .replace(/^(Microsoft|Google|Apple)\s+/i, '')
        .replace(/\s*-\s*Korean.*$/i, '')
        + (NEURAL_RE.test(v.name) ? ' ★' : '');
      const sel = v.voiceURI === state.ttsVoiceURI ? ' selected' : '';
      opts.push(`<option value="${escapeHtml(v.voiceURI)}"${sel}>${escapeHtml(label)}</option>`);
    });
    el.ttsVoiceSelect.innerHTML = opts.join('');
    if (el.ttsVoiceHint) {
      el.ttsVoiceHint.textContent = ko.length ? `${ko.length}개 감지` : '한국어 음성 없음';
    }
  }

  if (synth && typeof synth.onvoiceschanged !== 'undefined') {
    synth.onvoiceschanged = () => {
      cachedMaleVoice = selectBestKoreanMaleVoice();
      populateVoiceSelect();
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
    const chapLabel = (page && page.chapterNumber) || '1장';
    const where = page && page.type === 'content' ? ` (${page.pageNo}쪽)` : '';
    if (isPlaying) {
      el.ttsStatusText.textContent = `${chapLabel} 낭독 중${where}`;
    } else if (isPaused) {
      el.ttsStatusText.textContent = `일시정지됨${where}`;
    } else {
      el.ttsStatusText.textContent = '문단을 탭하면 그곳부터 읽어요';
    }
  }

  function cancelSpeechInternal() {
    currentUtterance = null; // stale utterance callbacks compare against this and bail out
    if (synth) {
      synth.cancel();
      // Chrome: a new speak() after cancel() stays silent while the engine is still flagged paused
      if (synth.paused) synth.resume();
    }
  }

  // Speak one text with the tuned voice; onDone fires only if this utterance is still current.
  function speakText(text, onDone) {
    cancelSpeechInternal();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    const { voice, userPicked } = resolveTtsVoice();
    if (voice) utter.voice = voice;
    // Native male voice → warm 0.94; user-picked other voice → natural 1.0; auto fallback → 0.78 for a gentle male tone
    utter.pitch = isLikelyMaleVoice(voice) ? 0.94 : (userPicked ? 1.0 : 0.78);
    utter.rate = state.ttsRate * 0.95;

    const finish = () => {
      if (currentUtterance !== utter || state.ttsStatus !== 'playing') return;
      onDone();
    };
    utter.onend = finish;
    utter.onerror = (ev) => {
      if (currentUtterance !== utter) return;
      if (ev.error === 'interrupted' || ev.error === 'canceled') return;
      finish();
    };
    currentUtterance = utter;
    synth.speak(utter);
  }

  function ttsAdvancePage() {
    clearTtsHighlight();
    if (state.currentPageIndex < state.pages.length - 1) {
      state.ttsParaOffset = 0;
      turnToPage(state.currentPageIndex + 1, 'forward', () => {
        if (state.ttsStatus === 'playing') speakCurrentParagraph();
      });
    } else {
      stopTts();
      el.ttsStatusText.textContent = '완독 완료';
    }
  }

  function speakCurrentParagraph() {
    if (!synth) {
      alert('이 브라우저는 음성 낭독(TTS)을 지원하지 않습니다.');
      return;
    }

    const page = state.pages[state.currentPageIndex];
    if (!page) return;

    if (page.type === 'cover') {
      state.ttsStatus = 'playing';
      state.ttsParaOffset = 0;
      updateTtsUi();
      ttsAdvancePage();
      return;
    }

    if (page.type === 'credits') {
      stopTts();
      el.ttsStatusText.textContent = '완독 완료';
      return;
    }

    if (page.type === 'chapter') {
      state.ttsStatus = 'playing';
      updateTtsUi();
      speakText(`${page.chapterNumber}. ${page.chapterSubtitle}.`, ttsAdvancePage);
      return;
    }

    const paraNodes = el.currentPage.querySelectorAll('p.novel-para');
    if (state.ttsParaOffset >= paraNodes.length) {
      ttsAdvancePage();
      return;
    }

    const targetNode = paraNodes[state.ttsParaOffset];
    const textToRead = targetNode ? targetNode.textContent.trim() : '';
    if (!textToRead) {
      state.ttsParaOffset++;
      speakCurrentParagraph();
      return;
    }

    highlightCurrentParagraph(state.ttsParaOffset);
    state.ttsStatus = 'playing';
    updateTtsUi();
    speakText(textToRead, () => {
      state.ttsParaOffset++;
      speakCurrentParagraph();
    });
  }

  // Start reading from a specific paragraph on the current page (tap-to-read)
  function speakFromParagraph(offset) {
    if (!synth || state.isFlipping) return;
    cancelSpeechInternal();
    el.ttsPlayerBar.classList.remove('hidden');
    state.ttsParaOffset = Math.max(0, offset);
    state.ttsStatus = 'playing';
    speakCurrentParagraph();
  }

  // The novel paragraph under a pointer event — only while the TTS player is open
  function paragraphUnderPointer(e) {
    if (el.ttsPlayerBar.classList.contains('hidden')) return null;
    if (typeof e.clientX !== 'number') return null;
    const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
    return stack.find((n) => n.matches && n.matches('#currentPage p.novel-para')) || null;
  }

  function startOrResumeTts() {
    if (!synth) return;
    el.ttsPlayerBar.classList.remove('hidden');

    if (state.ttsStatus === 'playing') {
      state.ttsStatus = 'paused';
      if (synth.speaking) synth.pause();
      updateTtsUi();
    } else if (state.ttsStatus === 'paused') {
      state.ttsStatus = 'playing';
      if (synth.paused) {
        synth.resume();
        updateTtsUi();
      } else {
        speakCurrentParagraph(); // browser dropped the paused utterance (common on mobile)
      }
    } else {
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
  // 7. Ambient Starfield (with occasional falling star)
  // =========================================================================
  function initStarfield() {
    const canvas = el.starCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let shoot = null;

    function resizeStarCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.floor((canvas.width * canvas.height) / 13000);
      stars = Array.from({ length: Math.min(110, Math.max(30, count)) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.016 + 0.004
      }));
    }

    resizeStarCanvas();
    window.addEventListener('resize', resizeStarCanvas);

    function drawStars() {
      if (state.theme === 'starlight') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stars) {
          s.phase += s.speed;
          const alpha = 0.22 + 0.55 * Math.sin(s.phase);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(216, 181, 106, ${Math.max(0.06, alpha)})`;
          ctx.fill();
        }

        // A star falls roughly every ~12s, drifting down-left and fading
        if (!shoot && Math.random() < 0.0014) {
          shoot = {
            x: canvas.width * (0.3 + Math.random() * 0.65),
            y: canvas.height * Math.random() * 0.4,
            vx: -4.2,
            vy: 2.6,
            life: 1,
            len: 110
          };
        }
        if (shoot) {
          const tx = shoot.x + shoot.len * 0.85;
          const ty = shoot.y - shoot.len * 0.53;
          const grad = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
          grad.addColorStop(0, `rgba(242, 220, 163, ${0.9 * shoot.life})`);
          grad.addColorStop(1, 'rgba(242, 220, 163, 0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(shoot.x, shoot.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          shoot.x += shoot.vx;
          shoot.y += shoot.vy;
          shoot.life -= 0.018;
          if (shoot.life <= 0) shoot = null;
        }
      }
      requestAnimationFrame(drawStars);
    }
    requestAnimationFrame(drawStars);
  }

  // =========================================================================
  // 8. UI Events
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
      const target = state.pages[targetPage];
      if (target && target.type === 'content' && target.pageNo > 1) {
        el.resumeToastMsg.textContent = `${saved.chapterTitle} · ${target.pageNo}쪽부터`;
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
    const type = curPage ? curPage.type : 'cover';
    const chapId = curPage ? curPage.chapterId : 0;
    const paraIdx = curPage ? curPage.startParaIndex : 0;

    paginateNovel();
    renderTocList();
    renderBookmarkList();

    if (type === 'cover') {
      state.currentPageIndex = 0;
    } else if (type === 'credits') {
      state.currentPageIndex = state.pages.length - 1;
    } else if (type === 'chapter') {
      state.currentPageIndex = state.chapterStartPages[chapId] || 1;
    } else {
      state.currentPageIndex = findPageForParagraph(chapId, paraIdx);
    }
    renderCurrentPage();
  }

  function bindEvents() {
    // Touch/click zones — while the TTS player is open, tapping a paragraph reads from there
    function zoneClick(fallback) {
      return (e) => {
        const para = paragraphUnderPointer(e);
        if (para) {
          const paraNodes = Array.from(el.currentPage.querySelectorAll('p.novel-para'));
          speakFromParagraph(paraNodes.indexOf(para));
          return;
        }
        fallback();
      };
    }
    el.zonePrev.addEventListener('click', zoneClick(prevPage));
    el.zoneNext.addEventListener('click', zoneClick(nextPage));
    el.zoneCenter.addEventListener('click', zoneClick(toggleUiBars));

    // Swipe
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

    // Bottom bar
    el.btnPrevPage.addEventListener('click', prevPage);
    el.btnNextPage.addEventListener('click', nextPage);
    el.pageSlider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      const page = state.pages[val];
      if (page) {
        el.bottomPageCounter.textContent = page.type === 'content' ? `${pageLabel(page)}쪽` : pageLabel(page);
        el.bottomChapterInfo.textContent = page.chapterTitle;
        setSliderVisual(val);
      }
    });
    el.pageSlider.addEventListener('change', (e) => {
      turnToPage(Number(e.target.value));
    });

    // Keyboard
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

    // TOC drawer
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

    el.btnBookmarkPage.addEventListener('click', toggleCurrentPageBookmark);

    // Settings sheet
    el.btnOpenSettings.addEventListener('click', () => {
      el.tocDrawer.classList.add('hidden');
      el.settingsPanel.classList.toggle('hidden');
      el.drawerBackdrop.classList.toggle('hidden', el.settingsPanel.classList.contains('hidden'));
    });
    el.btnCloseSettings.addEventListener('click', closeDrawers);

    document.querySelectorAll('[data-theme-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.theme = btn.getAttribute('data-theme-select');
        applyVisualSettings();
        saveSettings();
      });
    });

    document.querySelectorAll('[data-font-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.fontKey = btn.getAttribute('data-font-select');
        applyVisualSettings();
        saveSettings();
        preservePositionAndRepaginate();
      });
    });

    const stepSetting = (apply) => () => {
      apply();
      applyVisualSettings();
      saveSettings();
      preservePositionAndRepaginate();
    };
    el.btnFontDec.addEventListener('click', stepSetting(() => { if (state.fontSize > 14) state.fontSize -= 1; }));
    el.btnFontInc.addEventListener('click', stepSetting(() => { if (state.fontSize < 26) state.fontSize += 1; }));
    el.btnLineDec.addEventListener('click', stepSetting(() => { if (state.lineHeight > 1.55) state.lineHeight = Number((state.lineHeight - 0.1).toFixed(2)); }));
    el.btnLineInc.addEventListener('click', stepSetting(() => { if (state.lineHeight < 2.35) state.lineHeight = Number((state.lineHeight + 0.1).toFixed(2)); }));

    // Mode toggle
    el.btnToggleMode.addEventListener('click', () => {
      state.mode = state.mode === 'flip' ? 'scroll' : 'flip';
      saveSettings();
      updateModeView();
    });

    // TTS
    el.btnOpenTts.addEventListener('click', () => {
      if (el.ttsPlayerBar.classList.contains('hidden')) {
        el.ttsPlayerBar.classList.remove('hidden');
        if (state.ttsStatus !== 'playing') startOrResumeTts();
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

    if (el.ttsVoiceSelect) {
      el.ttsVoiceSelect.addEventListener('change', (e) => {
        state.ttsVoiceURI = e.target.value || '';
        saveSettings();
        if (state.ttsStatus === 'playing') speakCurrentParagraph();
      });
    }

    window.addEventListener('beforeunload', () => {
      cancelSpeechInternal();
    });

    // Resize → repaginate (flip mode)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.mode === 'flip') preservePositionAndRepaginate();
      }, 220);
    });
  }

  // =========================================================================
  // 9. Init
  // =========================================================================
  function init() {
    loadSavedSettings();
    applyVisualSettings();
    el.modeIcon.innerHTML = MODE_ICONS.flip;
    initStarfield();
    paginateNovel();
    renderTocList();
    renderBookmarkList();
    renderCurrentPage();
    if (state.mode === 'scroll') {
      updateModeView();
    }
    bindEvents();
    populateVoiceSelect();
    checkSavedProgressToast();

    // Re-measure once web fonts are in
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (state.mode === 'flip') preservePositionAndRepaginate();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
