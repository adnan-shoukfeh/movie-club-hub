import { useState, useEffect } from "react";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface PosterImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
  loading?: "eager" | "lazy";
}

export function PosterImage({
  src,
  alt,
  className,
  fallbackClassName,
  iconClassName,
  loading = "lazy",
}: PosterImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      aria-label={`${alt} poster unavailable`}
      role="img"
      className={cn(
        "flex items-center justify-center border border-border bg-secondary text-muted-foreground",
        fallbackClassName ?? className
      )}
    >
      <Film className={cn("h-1/3 w-1/3", iconClassName)} />
    </div>
  );
}
