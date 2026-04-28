import { Turn } from "../data/mockData";
import { users } from "../data/mockData";
import { Star, TrendingUp, Award, Users } from "lucide-react";

interface TurnResultsProps {
  turn: Turn;
  clubMembers: string[];
}

export function TurnResults({ turn, clubMembers }: TurnResultsProps) {
  const avgRating = turn.ratings.length > 0
    ? turn.ratings.reduce((sum, r) => sum + r.rating, 0) / turn.ratings.length
    : 0;

  const participationRate = (turn.ratings.length / clubMembers.length) * 100;

  return (
    <div className="space-y-6">
      <div className="border-8 border-[#FDB913] bg-[#003087] p-8">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b-4 border-[#FDB913]">
          <div className="w-12 h-12 bg-[#FDB913] flex items-center justify-center">
            <Award className="w-7 h-7 text-[#003087]" />
          </div>
          <h3 className="text-3xl font-black text-[#FDB913] uppercase">Final Results</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-8 bg-[#001d3d] border-4 border-[#FDB913]">
            <p className="text-sm font-black text-[#FDB913] mb-4 uppercase tracking-widest">
              Average Rating
            </p>
            <div className="flex items-center gap-4">
              <Star className="w-10 h-10 fill-[#FDB913] text-[#FDB913]" />
              <span className="text-6xl font-black text-white">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-2xl text-white/60 mt-4 font-bold">/5.0</span>
            </div>
          </div>

          <div className="p-8 bg-[#001d3d] border-4 border-white/30">
            <p className="text-sm font-black text-white mb-4 uppercase tracking-widest">
              Participation
            </p>
            <div className="flex items-center gap-4">
              <Users className="w-10 h-10 text-[#FDB913]" />
              <span className="text-6xl font-black text-white">
                {participationRate.toFixed(0)}
              </span>
              <span className="text-2xl text-white/60 mt-4 font-bold">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-4 border-[#003087] bg-[#001d3d] p-6">
        <h4 className="font-black text-[#FDB913] mb-6 text-2xl flex items-center gap-3 uppercase pb-4 border-b-4 border-[#003087]">
          <Star className="w-7 h-7 fill-[#FDB913]" />
          Member Reviews
        </h4>

        <div className="space-y-4">
          {turn.ratings.map((rating) => {
            const user = users[rating.userId];
            return (
              <div
                key={rating.userId}
                className="p-5 bg-[#003087] border-l-8 border-[#FDB913]"
              >
                <div className="flex items-start gap-4 mb-3">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-14 h-14 rounded-full border-4 border-[#FDB913]"
                  />
                  <div className="flex-1">
                    <p className="font-black text-white mb-2 text-lg">{user.name}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              star <= rating.rating
                                ? "fill-[#FDB913] text-[#FDB913]"
                                : "text-white/20"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="px-3 py-1 bg-[#FDB913] border-2 border-[#001d3d] font-black text-[#003087] text-sm">
                        {rating.rating.toFixed(1)}
                      </span>
                    </div>
                    <time className="text-xs text-white/60 font-bold uppercase">
                      {new Date(rating.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </time>
                  </div>
                </div>
                {rating.review && (
                  <p className="text-sm text-white leading-relaxed pl-16 mt-2 border-t-2 border-white/20 pt-3">
                    "{rating.review}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
