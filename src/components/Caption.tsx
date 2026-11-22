import { useEffect, useRef } from 'react';
import type { Film } from '../lib/films';

interface CaptionProps {
  film: Film;
  dir: number;
  changeSeq: number;
}

function swapMaskLine(container: HTMLElement | null, text: string, dir: number, reducedMotion: boolean) {
  if (!container) return;

  if (reducedMotion) {
    container.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'caption-line';
    span.textContent = text;
    container.appendChild(span);
    return;
  }

  const direction = dir >= 0 ? 1 : -1;
  const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const duration = 650;

  // Animate out existing non-leaving spans from their current transform
  const existing = Array.from(container.children) as HTMLElement[];
  for (const oldEl of existing) {
    if (oldEl.dataset.leaving === '1') continue;
    oldEl.dataset.leaving = '1';
    const currentTransform = getComputedStyle(oldEl).transform;
    const fromTransform = currentTransform && currentTransform !== 'none' ? currentTransform : 'translateY(0%)';
    oldEl.getAnimations().forEach((a) => a.cancel());
    const anim = oldEl.animate(
      [
        { transform: fromTransform },
        { transform: `translateY(${-direction * 105}%)` },
      ],
      { duration, easing, fill: 'both' }
    );
    anim.onfinish = () => {
      if (oldEl.parentElement === container) {
        oldEl.remove();
      }
    };
  }

  // Append entering span positioned over the first sibling
  const nextEl = document.createElement('span');
  nextEl.className = existing.length > 0 ? 'caption-line is-overlay' : 'caption-line';
  nextEl.textContent = text;
  container.appendChild(nextEl);

  const enterAnim = nextEl.animate(
    [
      { transform: `translateY(${direction * 105}%)` },
      { transform: 'translateY(0%)' },
    ],
    { duration, easing, fill: 'both' }
  );

  enterAnim.onfinish = () => {
    if (nextEl.dataset.leaving !== '1') {
      nextEl.className = 'caption-line';
      enterAnim.cancel();
      // Remove any leftover sibling nodes
      Array.from(container.children).forEach((child) => {
        if (child !== nextEl && (child as HTMLElement).dataset.leaving === '1') {
          child.remove();
        }
      });
    }
  };
}

export function Caption({ film, dir, changeSeq }: CaptionProps) {
  const titleRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const yearRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const subtitleText = `${film.romaji} / ${film.kanji}`;
    const yearText = String(film.year);

    if (!initializedRef.current) {
      initializedRef.current = true;
      swapMaskLine(titleRef.current, film.title, 1, true);
      swapMaskLine(subRef.current, subtitleText, 1, true);
      swapMaskLine(yearRef.current, yearText, 1, true);
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    swapMaskLine(titleRef.current, film.title, dir, reduced);
    swapMaskLine(subRef.current, subtitleText, dir, reduced);
    swapMaskLine(yearRef.current, yearText, dir, reduced);
  }, [film.id, changeSeq]);

  return (
    <div className="caption-wrap" aria-live="polite" data-testid="film-caption">
      <div ref={titleRef} className="caption-mask caption-mask-title" />
      <div ref={subRef} className="caption-mask caption-mask-sub" />
      <div ref={yearRef} className="caption-mask caption-mask-year" />
    </div>
  );
}
