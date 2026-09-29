import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Extra rows rendered above and below the viewport so fast scrolling does not flash. */
const OVERSCAN = 10;

interface Props {
  count: number;
  /** Fixed row height in px. Every row must render at exactly this height. */
  rowHeight: number;
  renderRow: (index: number) => ReactNode;
  /** Sticky header rendered above the rows, inside the scroll area. */
  header?: ReactNode;
  /** Called with the rendered range `[start, end)`, e.g. to fetch missing pages. */
  onRangeChange?: (start: number, end: number) => void;
  className?: string;
}

/**
 * Windowed list: only the visible rows are in the DOM, so folders with 100k entries stay
 * smooth. Give it a `key` that changes when the data set changes to reset the scroll.
 */
export function VirtualList({
  count,
  rowHeight,
  renderRow,
  header,
  onRangeChange,
  className = "",
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // The observer fires once right away, which gives the initial height.
    const observer = new ResizeObserver(() => setViewport(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The sticky header shifts rows down a little; OVERSCAN covers that difference.
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + OVERSCAN);

  useEffect(() => {
    onRangeChange?.(start, end);
  }, [start, end, onRangeChange]);

  const rows: ReactNode[] = [];
  for (let i = start; i < end; i++) {
    rows.push(
      <div
        key={i}
        role="row"
        style={{ position: "absolute", top: i * rowHeight, left: 0, right: 0, height: rowHeight }}
      >
        {renderRow(i)}
      </div>,
    );
  }

  return (
    <div
      ref={scroller}
      role="table"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={`overflow-y-auto ${className}`}
    >
      {header && <div className="sticky top-0 z-10">{header}</div>}
      <div style={{ position: "relative", height: count * rowHeight }}>{rows}</div>
    </div>
  );
}
