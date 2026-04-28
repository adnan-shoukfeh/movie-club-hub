import { useState } from "react";
import { Star, Send } from "lucide-react";

interface RatingReviewProps {
  turnId: string;
  clubId: string;
  reopened?: boolean;
}

export function RatingReview({ turnId, clubId, reopened }: RatingReviewProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");

  const handleSubmit = () => {
    console.log("Submit rating:", { turnId, clubId, rating, review });
    alert("Rating submitted! (In production, this would save to your backend)");
  };

  return (
    <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
      {reopened && (
        <div className="mb-4 p-3 bg-[#FDB913] border-4 border-[#003087] text-sm text-[#003087] font-black uppercase">
          ⚡ Admin has reopened the review window
        </div>
      )}
      <h3 className="font-black text-[#FDB913] mb-6 text-2xl uppercase tracking-tight">Rate & Review</h3>

      <div className="mb-6">
        <label className="block text-sm font-black text-white mb-3 uppercase tracking-widest">
          Your Rating
        </label>
        <div className="flex gap-2 items-center">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(value)}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                className={`w-10 h-10 transition-colors ${
                  value <= (hoverRating || rating)
                    ? "fill-[#FDB913] text-[#FDB913]"
                    : "text-[#003087]"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <div className="ml-3 px-4 py-2 bg-[#FDB913] border-4 border-[#003087]">
              <span className="text-2xl font-black text-[#003087]">
                {rating}.0
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-black text-white mb-3 uppercase tracking-widest">
          Your Review (Optional)
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your thoughts about the movie..."
          className="w-full px-4 py-3 border-4 border-[#003087] bg-[#001d3d] text-white placeholder:text-white/40 focus:outline-none focus:border-[#FDB913] resize-none font-medium"
          rows={4}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={rating === 0}
        className="w-full sm:w-auto px-6 py-3 bg-[#FDB913] text-[#003087] border-4 border-[#003087] hover:bg-[#003087] hover:text-[#FDB913] hover:border-[#FDB913] disabled:bg-[#003087] disabled:text-white/30 disabled:cursor-not-allowed disabled:border-[#003087] transition-all font-black uppercase flex items-center justify-center gap-2"
      >
        <Send className="w-5 h-5" />
        Submit Rating
      </button>
    </div>
  );
}
