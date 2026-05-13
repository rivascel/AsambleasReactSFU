// hooks/useVideoQuality.js

import { useEffect, useState } from "react";

export default function useVideoQuality(videoRef) {
  const [quality, setQuality] = useState("mid");

  useEffect(() => {
    if (!videoRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;

      if (width < 200) setQuality("low");
      else if (width < 600) setQuality("mid");
      else setQuality("high");
    });

    observer.observe(videoRef.current);

    return () => observer.disconnect();
  }, [videoRef]);

  return quality;
}