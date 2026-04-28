import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number; // 1-10 scale
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StarRating({ rating, size = "md", className = "" }: StarRatingProps) {
  const starRating = rating / 2; // Convert to 5-star scale

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const starSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillAmount = Math.min(1, Math.max(0, starRating - (starIndex - 1)));
        // Round to nearest 0.25
        const roundedFill = Math.round(fillAmount * 4) / 4;

        return (
          <div key={starIndex} className="relative">
            {/* Background (empty) star */}
            <Star className={`${starSize} text-secondary`} />
            {/* Foreground (filled) star with clip */}
            {roundedFill > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${roundedFill * 100}%` }}
              >
                <Star className={`${starSize} fill-primary text-primary`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
