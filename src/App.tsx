import { useCallback, useEffect, useRef, useState } from 'react';
import { Caption } from './components/Caption';
import { CustomCursor } from './components/CustomCursor';
import { DecadeTabs } from './components/DecadeTabs';
import { FilmDetail } from './components/FilmDetail';
import { PaperGrain } from './components/PaperGrain';
import { FILMS, INITIAL_FILM_INDEX } from './lib/films';
import type { ScreenRect } from './lib/shelfMath';
import { ShelfStage, type CursorMode } from './three/ShelfStage';

function resolveInitialFilmIndex(): number {
  if (typeof window === 'undefined') return INITIAL_FILM_INDEX;
  const hash = window.location.hash.replace(/^#/, '');
  const match = hash.match(/film=([a-z]+)/i);
  if (match) {
    const found = FILMS.findIndex((f) => f.id === match[1].toLowerCase());
    if (found >= 0) return found;
  }
  return INITIAL_FILM_INDEX;
}

export default function App() {
  const initialIndex = useRef(resolveInitialFilmIndex()).current;
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const [captionDir, setCaptionDir] = useState<number>(1);
  const [captionSeq, setCaptionSeq] = useState<number>(0);

  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailFilmIndex, setDetailFilmIndex] = useState<number>(initialIndex);
  const [coverRect, setCoverRect] = useState<ScreenRect | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ShelfStage | null>(null);
  const playRingRef = useRef<HTMLButtonElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const detailOpenRef = useRef<boolean>(false);

  detailOpenRef.current = detailOpen;

  const openActiveFilmDetail = useCallback((filmIdx?: number, precomputedRect?: ScreenRect) => {
    const stage = stageRef.current;
    if (!stage) return;
    const idx = typeof filmIdx === 'number' ? filmIdx : stage.getActiveFilmIndex();
    const rect = precomputedRect ?? stage.getActiveCoverRect();
    setDetailFilmIndex(idx);
    setCoverRect(rect);
    setDetailOpen(true);
    stage.setDetailOpen(true);
  }, []);

  const requestCloseDetail = useCallback(() => {
    setDetailOpen(false);
  }, []);

  const handleCloseComplete = useCallback(() => {
    stageRef.current?.setDetailOpen(false);
  }, []);

  // Mount Three.js ShelfStage once in an isolated ref container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const stage = new ShelfStage(
      mount,
      {
        onActiveFilmChange: (filmIndex, dir) => {
          setActiveIndex(filmIndex);
          setCaptionDir(dir);
          setCaptionSeq((seq) => seq + 1);
        },
        onOpenDetail: (filmIndex, rect) => {
          openActiveFilmDetail(filmIndex, rect);
        },
        onPlayRingUpdate: (x, y, scale) => {
          const ring = playRingRef.current;
          if (!ring) return;
          ring.style.left = `${x.toFixed(1)}px`;
          ring.style.top = `${y.toFixed(1)}px`;
          ring.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
          ring.style.pointerEvents = scale > 0.25 ? 'auto' : 'none';
        },
        onCursorUpdate: (x, y, mode: CursorMode, visible: boolean) => {
          const cur = cursorRef.current;
          if (!cur) return;
          cur.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          cur.classList.toggle('is-hidden', !visible);
          cur.classList.toggle('spine', mode === 'spine');
          cur.classList.toggle('btn', mode === 'btn');
          cur.classList.toggle('open', mode === 'open');
        },
        onMetricsUpdate: (_H, ws, d) => {
          mount.style.setProperty('--ws', `${ws.toFixed(2)}px`);
          mount.style.setProperty('--d', `${d.toFixed(2)}px`);
        },
      },
      initialIndex
    );

    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [initialIndex, openActiveFilmDetail]);

  // Keyboard navigation: Left, Right, Enter (when focus on body), Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailOpenRef.current) {
          e.preventDefault();
          requestCloseDetail();
        }
        return;
      }

      if (detailOpenRef.current) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stageRef.current?.stepBy(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stageRef.current?.stepBy(-1);
      } else if (e.key === 'Enter') {
        const activeEl = document.activeElement;
        if (!activeEl || activeEl === document.body || activeEl === document.documentElement) {
          e.preventDefault();
          openActiveFilmDetail();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openActiveFilmDetail, requestCloseDetail]);

  const activeFilm = FILMS[activeIndex] ?? FILMS[INITIAL_FILM_INDEX];
  const detailFilm = FILMS[detailFilmIndex] ?? activeFilm;

  const handleShareClick = (network: 'FB' | 'TW') => {
    const hash = `#film=${activeFilm.id}`;
    window.history.replaceState(null, '', hash);
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setShareNote(`${network} LINK COPIED`);
    window.setTimeout(() => setShareNote(null), 2000);
  };

  return (
    <main
      data-active-film={activeFilm.id}
      data-detail-open={detailOpen ? 'true' : 'false'}
    >
      {/* 1. Top Bar */}
      <header className="topbar">
        <a
          href="#film=noon"
          className="lbl box topbar-left"
          onClick={(e) => {
            e.preventDefault();
            if (detailOpen) {
              requestCloseDetail();
            } else {
              stageRef.current?.jumpToFilmIndex(INITIAL_FILM_INDEX);
            }
          }}
        >
          BACK / 戻る
        </a>

        <div className="vasari-logo">
          <span className="vasari-logo-sc">莱昂·瓦萨里</span>
          <span className="vasari-logo-latin">LEON VASARI</span>
        </div>

        <span className="lbl topbar-right">CAREER 1958年〜1989年</span>
      </header>

      {/* 2. Decade Tabs */}
      <DecadeTabs
        activeDecade={activeFilm.decade}
        onSelectDecade={(firstFilmIdx) => stageRef.current?.jumpToFilmIndex(firstFilmIdx)}
      />

      {/* 3. Three.js 3D VHS Shelf Stage */}
      <section className="shelf-section" aria-label="Filmography shelf">
        <div ref={canvasMountRef} className="shelf-canvas-mount" />
      </section>

      {/* 4. Play Ring */}
      <button
        ref={playRingRef}
        type="button"
        className="play-ring"
        aria-label="Open film"
        onClick={() => openActiveFilmDetail()}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="2,1 11,6 2,11" />
        </svg>
      </button>

      {/* 5. Masked Sliding Caption */}
      <Caption film={activeFilm} dir={captionDir} changeSeq={captionSeq} />

      {/* 6. Left & Right Arrows */}
      <button
        type="button"
        className="shelf-arrow shelf-arrow-prev"
        aria-label="Previous film"
        onClick={() => stageRef.current?.stepBy(-1)}
      >
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
          <path d="M5 1L1 5L5 9" stroke="currentColor" strokeWidth="1.2" />
          <line x1="1" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      <button
        type="button"
        className="shelf-arrow shelf-arrow-next"
        aria-label="Next film"
        onClick={() => stageRef.current?.stepBy(1)}
      >
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
          <path d="M13 1L17 5L13 9" stroke="currentColor" strokeWidth="1.2" />
          <line x1="17" y1="5" x2="1" y2="5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      {/* 7. Footer */}
      <footer className="site-footer">
        <span className="lbl">© LEON VASARI. ALL RIGHTS RESERVED.</span>
        <div className="lbl footer-social">
          {shareNote && <span className="footer-share-note">{shareNote}</span>}
          <a
            href={`#film=${activeFilm.id}`}
            aria-label="Share on Facebook"
            onClick={(e) => {
              e.preventDefault();
              handleShareClick('FB');
            }}
          >
            FB
          </a>
          <span aria-hidden="true">/</span>
          <a
            href={`#film=${activeFilm.id}`}
            aria-label="Share on Twitter"
            onClick={(e) => {
              e.preventDefault();
              handleShareClick('TW');
            }}
          >
            TW
          </a>
        </div>
      </footer>

      {/* Paper Grain Layer (above shelf & caption, below detail sheet) */}
      <PaperGrain />

      {/* Film Detail Dialog Sheet with Ink Reveal */}
      <FilmDetail
        film={detailFilm}
        isOpen={detailOpen}
        coverRect={coverRect}
        getCurrentCoverRect={() =>
          stageRef.current?.getActiveCoverRect() ?? {
            left: window.innerWidth * 0.4,
            top: window.innerHeight * 0.25,
            right: window.innerWidth * 0.6,
            bottom: window.innerHeight * 0.75,
            width: window.innerWidth * 0.2,
            height: window.innerHeight * 0.5,
          }
        }
        onCloseComplete={handleCloseComplete}
        onRequestClose={requestCloseDetail}
      />

      {/* Custom Ring / OPEN Disc Cursor */}
      <CustomCursor ref={cursorRef} />
    </main>
  );
}
