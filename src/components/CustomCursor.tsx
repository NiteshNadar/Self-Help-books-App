import { forwardRef } from 'react';

export const CustomCursor = forwardRef<HTMLDivElement>(function CustomCursor(_, ref) {
  return (
    <div ref={ref} className="custom-cursor is-hidden" aria-hidden="true">
      <span className="cursor-ring" />
      <span className="cursor-dot" />
      <span className="cursor-open-label">
        <span>OPEN</span>
        <span>開く</span>
      </span>
    </div>
  );
});
