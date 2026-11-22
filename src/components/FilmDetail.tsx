import { useEffect, useRef, useState } from 'react';
import { INK_BLOBS, type Film } from '../lib/films';
import {
  computeInkBlobRadius,
  computePosterImageBox,
  computeSheetClipInset,
  type ScreenRect,
} from '../lib/shelfMath';

interface FilmDetailProps {
  film: Film;
  isOpen: boolean;
  coverRect: ScreenRect | null;
  getCurrentCoverRect: () => ScreenRect;
  onCloseComplete: () => void;
  onRequestClose: () => void;
}

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 24);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

export function FilmDetail({
  film,
  isOpen,
  coverRect,
  getCurrentCoverRect,
  onCloseComplete,
  onRequestClose,
}: FilmDetailProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const blobRefs = useRef<Array<SVGCircleElement | null>>([]);
  const inkRafRef = useRef<number>(0);
  const activeSheetAnimRef = useRef<Animation | null>(null);
  const wasOpenRef = useRef(false);

  // Interactive archival screening reel state for WATCH THE FILM button
  const [reelActive, setReelActive] = useState(false);
  const [reelPlaying, setReelPlaying] = useState(true);
  const [reelSeconds, setReelSeconds] = useState(0);
  const reelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const posterBox = computePosterImageBox(film.id);

  // Reset reel panel whenever film changes or dialog closes
  useEffect(() => {
    if (!isOpen) {
      setReelActive(false);
      setReelPlaying(true);
      setReelSeconds(0);
    }
  }, [isOpen, film.id]);

  // Animated 35mm archival screening preview canvas when WATCH THE FILM is active
  useEffect(() => {
    if (!reelActive) return;
    const canvas = reelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();
    let elapsed = reelSeconds;

    const drawReelFrame = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, h);

      // Subtle projected gate frame
      const padX = 28;
      const padY = 18;
      const gw = w - padX * 2;
      const gh = h - padY * 2;

      // Soft warm monochrome projection flicker
      const flicker = 0.94 + Math.sin(t * 29) * 0.03 + Math.cos(t * 17) * 0.02;
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.46, 12, w * 0.5, h * 0.5, gw * 0.65);
      grad.addColorStop(0, `rgba(237, 235, 230, ${0.22 * flicker})`);
      grad.addColorStop(0.55, `rgba(31, 63, 176, ${0.14 * flicker})`);
      grad.addColorStop(1, 'rgba(20, 20, 20, 0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(padX, padY, gw, gh);

      // Horizontal archival horizon / desert / cinema corridor abstract bars moving slowly
      ctx.strokeStyle = 'rgba(237, 235, 230, 0.32)';
      ctx.lineWidth = 1;
      ctx.strokeRect(padX, padY, gw, gh);

      // Countdown leader circle during first 3 seconds, then title card & reel motion
      if (t < 3) {
        const count = 3 - Math.floor(t);
        const sweep = (t % 1) * Math.PI * 2;
        ctx.strokeStyle = 'rgba(237, 235, 230, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(w / 2 + Math.cos(sweep - Math.PI / 2) * 46, h / 2 + Math.sin(sweep - Math.PI / 2) * 46);
        ctx.stroke();

        ctx.fillStyle = '#EDEBE6';
        ctx.font = '400 34px Newsreader, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(count), w / 2, h / 2);
      } else {
        // Atmospheric film still composition with drifting light band
        const drift = ((t - 3) * 18) % (gw + 120) - 60;
        ctx.fillStyle = 'rgba(237, 235, 230, 0.08)';
        ctx.fillRect(padX + drift, padY, 44, gh);

        ctx.fillStyle = '#EDEBE6';
        ctx.font = '400 22px Newsreader, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(film.title, w / 2, h / 2 - 12);

        ctx.fillStyle = '#7E98F2';
        ctx.font = '600 10px "Inter Tight", sans-serif';
        ctx.fillText(`${film.romaji}  /  ${film.kanji}`, w / 2, h / 2 + 16);

        ctx.fillStyle = 'rgba(237, 235, 230, 0.58)';
        ctx.font = '500 9px "Inter Tight", sans-serif';
        ctx.fillText(`REEL 01 · ${film.gauge.toUpperCase()} · ${film.aspectRatio.toUpperCase()}`, w / 2, h - 32);
      }

      // Fine vertical film scratch
      const scratchX = padX + ((Math.sin(t * 7.3) * 0.5 + 0.5) * gw);
      ctx.strokeStyle = 'rgba(237, 235, 230, 0.12)';
      ctx.beginPath();
      ctx.moveTo(scratchX, padY);
      ctx.lineTo(scratchX, padY + gh);
      ctx.stroke();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (reelPlaying) {
        elapsed += dt;
        setReelSeconds(elapsed);
      }
      drawReelFrame(elapsed);
      if (reelPlaying) {
        raf = requestAnimationFrame(tick);
      }
    };

    drawReelFrame(elapsed);
    if (reelPlaying) {
      raf = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(raf);
  }, [reelActive, reelPlaying, film]);

  // Handle Open & Close Paper Sheet Growth + Masked Text Rises + 7-Blob Ink Reveal
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sheetEase = 'cubic-bezier(0.76, 0, 0.18, 1)';
    const textEase = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      cancelAnimationFrame(inkRafRef.current);
      if (activeSheetAnimRef.current) {
        activeSheetAnimRef.current.cancel();
        activeSheetAnimRef.current = null;
      }

      const rect = coverRect ?? getCurrentCoverRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const originX = rect.left + rect.width * 0.5;
      const originY = rect.top + rect.height * 0.5;
      const fromClip = computeSheetClipInset(rect, vw, vh);

      // Reset all ink blobs to radius 0 before reveal
      blobRefs.current.forEach((circle) => {
        if (circle) circle.setAttribute('r', '0');
      });

      el.classList.add('is-visible');
      el.style.transformOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;

      // 1. Paper sheet grows out of cover rect, rotating -4.5deg -> 0deg
      const sheetAnim = el.animate(
        [
          { clipPath: fromClip, transform: 'rotate(-4.5deg)' },
          { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' },
        ],
        {
          duration: reduced ? 1 : 1050,
          easing: sheetEase,
          fill: 'both',
        }
      );
      activeSheetAnimRef.current = sheetAnim;

      // 2. Masked text lines rise sequentially
      lineRefs.current.forEach((line, index) => {
        if (!line) return;
        line.getAnimations().forEach((a) => a.cancel());
        line.animate(
          [{ transform: 'translateY(110%)' }, { transform: 'translateY(0%)' }],
          {
            duration: reduced ? 1 : 900,
            delay: reduced ? 0 : 620 + index * 75,
            easing: textEase,
            fill: 'both',
          }
        );
      });

      // 3. Poster bleeds in as 7 ragged ink blots starting at 520ms (or -5000ms for reduced motion)
      const openTime = performance.now();
      const inkStart = reduced ? openTime - 5000 : openTime + 520;

      const stepInk = (now: number) => {
        const elapsedSinceInk = now - inkStart;
        for (let i = 0; i < INK_BLOBS.length; i++) {
          const circle = blobRefs.current[i];
          if (!circle) continue;
          const r = computeInkBlobRadius(elapsedSinceInk, INK_BLOBS[i].delay, 1250, 720);
          circle.setAttribute('r', r.toFixed(1));
        }

        if (!reduced && now - openTime < 2400) {
          inkRafRef.current = requestAnimationFrame(stepInk);
        } else if (!reduced) {
          // Ensure full radius at end of 2.4s loop
          for (let i = 0; i < INK_BLOBS.length; i++) {
            const circle = blobRefs.current[i];
            if (circle) circle.setAttribute('r', '720');
          }
        }
      };

      inkRafRef.current = requestAnimationFrame(stepInk);
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      cancelAnimationFrame(inkRafRef.current);

      const rect = getCurrentCoverRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const originX = rect.left + rect.width * 0.5;
      const originY = rect.top + rect.height * 0.5;
      const toClip = computeSheetClipInset(rect, vw, vh);

      el.style.transformOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;

      if (activeSheetAnimRef.current) {
        activeSheetAnimRef.current.cancel();
      }

      const closeAnim = el.animate(
        [
          { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' },
          { clipPath: toClip, transform: 'rotate(-4.5deg)' },
        ],
        {
          duration: reduced ? 1 : 850,
          easing: sheetEase,
          fill: 'both',
        }
      );
      activeSheetAnimRef.current = closeAnim;

      closeAnim.onfinish = () => {
        el.classList.remove('is-visible');
        closeAnim.cancel();
        lineRefs.current.forEach((line) => {
          line?.getAnimations().forEach((a) => a.cancel());
        });
        activeSheetAnimRef.current = null;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onCloseComplete();
      };
    }

    return () => {
      cancelAnimationFrame(inkRafRef.current);
    };
  }, [isOpen]);

  return (
    <div
      ref={dialogRef}
      className="detail"
      role="dialog"
      aria-modal="true"
      aria-label={`${film.title} film details`}
      aria-hidden={!isOpen}
      data-testid="film-detail-dialog"
    >
      <div className="detail-topbar">
        <button
          ref={closeBtnRef}
          type="button"
          className="lbl box detail-close"
          onClick={onRequestClose}
        >
          CLOSE / 閉じる
        </button>

        <div className="vasari-logo" aria-hidden="true">
          <span className="vasari-logo-sc">莱昂·瓦萨里</span>
          <span className="vasari-logo-latin">LEON VASARI</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-info">
          <div className="detail-mask">
            <span
              ref={(el) => {
                lineRefs.current[0] = el;
              }}
              className="detail-line lbl detail-sub"
            >
              {film.romaji} / {film.kanji}
            </span>
          </div>

          <div className="detail-mask">
            <span
              ref={(el) => {
                lineRefs.current[1] = el;
              }}
              className="detail-line"
            >
              <h1 className="detail-title">{film.title}</h1>
            </span>
          </div>

          <div className="detail-mask">
            <span
              ref={(el) => {
                lineRefs.current[2] = el;
              }}
              className="detail-line lbl detail-meta"
            >
              {film.year} / {film.genre} / {film.minutes} MIN
            </span>
          </div>

          <div className="detail-mask">
            <span
              ref={(el) => {
                lineRefs.current[3] = el;
              }}
              className="detail-line"
            >
              <p className="detail-synopsis">{film.synopsis}</p>
            </span>
          </div>

          <div className="detail-mask">
            <span
              ref={(el) => {
                lineRefs.current[4] = el;
              }}
              className="detail-line"
            >
              <p className="detail-credit">Written and directed by Leon Vasari. 監督作品</p>
            </span>
          </div>

          <div className="detail-mask">
            <span
              ref={(el) => {
                lineRefs.current[5] = el;
              }}
              className="detail-line"
            >
              <button
                type="button"
                className="lbl detail-watch-btn"
                onClick={() => {
                  setReelActive((prev) => !prev);
                  setReelPlaying(true);
                }}
              >
                {reelActive ? 'HIDE SCREENING REEL / 閉じる' : 'WATCH THE FILM / 映画を見る'}
              </button>
            </span>
          </div>

          {reelActive && (
            <div className="reel-panel" data-testid="screening-reel-panel">
              <canvas ref={reelCanvasRef} width={480} height={270} className="reel-canvas" />
              <div className="reel-controls">
                <button
                  type="button"
                  className="lbl box"
                  onClick={() => setReelPlaying((p) => !p)}
                >
                  {reelPlaying ? 'PAUSE / 一時停止' : 'PLAY / 再生'}
                </button>
                <span className="reel-time">
                  {formatTimecode(reelSeconds)} / {film.minutes}:00
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="detail-poster-col">
          <div className="detail-poster-frame">
            <svg
              className="detail-poster-svg"
              viewBox="0 0 474 900"
              aria-hidden="true"
            >
              <defs>
                <clipPath id="poster-crop-clip">
                  <rect x="0" y="0" width="474" height="900" rx="2" />
                </clipPath>

                <filter id="ink-bleed-filter" x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.011"
                    numOctaves="3"
                    seed="7"
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="120"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>

                <mask
                  id="ink-bleed-mask"
                  maskUnits="userSpaceOnUse"
                  x="-200"
                  y="-200"
                  width="874"
                  height="1300"
                >
                  <g filter="url(#ink-bleed-filter)" fill="#ffffff">
                    {INK_BLOBS.map((blob, idx) => (
                      <circle
                        key={idx}
                        ref={(el) => {
                          blobRefs.current[idx] = el;
                        }}
                        cx={blob.cx}
                        cy={blob.cy}
                        r="0"
                      />
                    ))}
                  </g>
                </mask>
              </defs>

              <g clipPath="url(#poster-crop-clip)" mask="url(#ink-bleed-mask)">
                <rect x="0" y="0" width="474" height="900" fill="#EAE5DC" />
                <image
                  href={posterBox.href}
                  x={posterBox.x}
                  y={posterBox.y}
                  width={posterBox.width}
                  height={posterBox.height}
                  preserveAspectRatio="none"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
