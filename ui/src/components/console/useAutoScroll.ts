import { useCallback, useEffect, useRef, useState } from "react";

export default function useAutoScroll(deps: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);

  // Tail-follow mode scrolls to bottom only when the user is near the end.
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (follow) {
      scrollToBottom();
    }
  }, [deps, follow, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 16;
    setFollow(nearBottom);
  }, []);

  return {
    containerRef,
    follow,
    setFollow,
    handleScroll,
    scrollToBottom,
  };
}
