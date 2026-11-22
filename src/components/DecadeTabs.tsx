import { useEffect, useLayoutEffect, useRef } from 'react';
import { DECADE_TABS, type DecadeKey } from '../lib/films';

interface DecadeTabsProps {
  activeDecade: Exclude<DecadeKey, 'all'>;
  onSelectDecade: (firstFilmIndex: number) => void;
}

export function DecadeTabs({ activeDecade, onSelectDecade }: DecadeTabsProps) {
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const syncIndicator = () => {
    const indicator = indicatorRef.current;
    const btn = buttonRefs.current[activeDecade];
    if (!indicator || !btn) return;
    indicator.style.width = `${btn.offsetWidth}px`;
    indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  };

  useLayoutEffect(() => {
    syncIndicator();
  }, [activeDecade]);

  useEffect(() => {
    const onResize = () => syncIndicator();
    window.addEventListener('resize', onResize);

    // Re-sync after web fonts load so widths match final glyph metrics
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncIndicator).catch(() => {});
    }

    return () => window.removeEventListener('resize', onResize);
  }, [activeDecade]);

  return (
    <nav className="tabs-nav" aria-label="Decades">
      <div className="tabs-track">
        <span ref={indicatorRef} className="tabs-indicator" aria-hidden="true" />
        {DECADE_TABS.map((tab) => {
          const isActive = tab.key !== 'all' && tab.key === activeDecade;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                buttonRefs.current[tab.key] = el;
              }}
              type="button"
              className={`lbl tab-btn${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelectDecade(tab.firstFilmIndex)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
