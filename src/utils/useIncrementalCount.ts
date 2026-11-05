import { useEffect, useRef, useState } from "react";

// Renders a long list a page at a time: the returned sentinel ref goes on an
// element placed after the last rendered row, and each time it scrolls into
// view the count grows by `step`. Same approach as the "not configured"
// group of the games list.
export const useIncrementalCount = (
  total: number,
  resetKey: unknown,
  step = 50,
) => {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    setCount(step);
  }, [resetKey, step]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingMore.current &&
          count < total
        ) {
          loadingMore.current = true;
          setCount((c) => Math.min(c + step, total));
          setTimeout(() => {
            loadingMore.current = false;
          }, 300);
        }
      },
      { threshold: 0, rootMargin: "0px", root: null },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, total, step]);

  return { count: Math.min(count, total), sentinelRef, hasMore: count < total };
};
