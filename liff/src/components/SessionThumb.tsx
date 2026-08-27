import { useEffect, useState } from "react";
import { contentUrl, needsNgrokFetch, ngrokFetchHeaders } from "../lib/contentUrl";

interface Props {
  src: string;
  className?: string;
}

export function SessionThumb({ src, className = "slot-thumb" }: Props) {
  const [displaySrc, setDisplaySrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = contentUrl(src);
    if (!url) {
      setDisplaySrc("");
      setFailed(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      try {
        if (needsNgrokFetch(url)) {
          const res = await fetch(url, { headers: ngrokFetchHeaders() });
          if (!res.ok) throw new Error("fetch failed");
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setDisplaySrc(objectUrl);
            setFailed(false);
          }
          return;
        }

        if (!cancelled) {
          setDisplaySrc(url);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setDisplaySrc("");
          setFailed(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!displaySrc) {
    return (
      <div
        className={`${className}${failed ? " slot-thumb-error" : " slot-thumb-placeholder"}`}
        aria-hidden="true"
      />
    );
  }

  return <img className={className} src={displaySrc} alt="" loading="lazy" />;
}
