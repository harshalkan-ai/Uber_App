'use client';

import { useState } from 'react';
import { Star, ThumbsUp, Check, X } from 'lucide-react';

interface RatingModalProps {
  isOpen: boolean;
  driverName?: string;
  vehicleModel?: string;
  fareAmount?: number;
  onSubmit: (rating: number, feedback: string) => void;
  onClose: () => void;
}

const COMPLIMENT_TAGS = [
  '🌟 Clean & hygienic car',
  '🏎️ Smooth & safe driving',
  '🤝 Polite & courteous',
  '⏱️ On-time pickup',
  '🗺️ Good route navigation',
  '❄️ Comfortable AC',
];

export default function RatingModal({
  isOpen,
  driverName = 'Driver Partner',
  vehicleModel = 'Tata Nexon',
  fareAmount = 145.0,
  onSubmit,
  onClose,
}: RatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => {
      onSubmit(rating, `${selectedTags.join(', ')}. ${comment}`.trim());
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5 text-black border border-neutral-100 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div>
            <span className="text-xl font-bold tracking-tight">Rate Your Trip</span>
            <p className="text-xs text-neutral-500">How was your ride with {driverName}?</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black"
          >
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="py-10 text-center flex flex-col items-center gap-3 animate-fadeIn">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
              ✓
            </div>
            <h3 className="text-lg font-bold text-black">Thank you for your feedback!</h3>
            <p className="text-xs text-neutral-500">
              Your rating helps keep our community safe and enjoyable.
            </p>
          </div>
        ) : (
          <>
            {/* Driver Avatar & Vehicle */}
            <div className="flex items-center gap-3.5 bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100">
              <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
                {driverName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-black">{driverName}</div>
                <div className="text-xs text-neutral-500">{vehicleModel}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400">Total Paid</span>
                <div className="text-sm font-bold text-black">₹{fareAmount.toFixed(2)}</div>
              </div>
            </div>

            {/* Interactive Stars */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    id={`rate-star-${star}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      size={32}
                      className={`transition-colors ${
                        (hoverRating || rating) >= star
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-neutral-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-neutral-600">
                {rating === 5 && 'Outstanding! 🌟'}
                {rating === 4 && 'Good trip 👍'}
                {rating === 3 && 'Average 👌'}
                {rating === 2 && 'Needs improvement 👎'}
                {rating === 1 && 'Poor experience ⚠️'}
              </span>
            </div>

            {/* Compliments Chips */}
            <div>
              <div className="text-xs font-bold text-neutral-700 mb-2">What went well?</div>
              <div className="flex flex-wrap gap-1.5">
                {COMPLIMENT_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
                        isSelected
                          ? 'bg-black text-white border-black font-semibold'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment */}
            <div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave an optional note for Rajesh..."
                rows={2}
                className="w-full text-xs p-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-rating"
              type="button"
              onClick={handleSubmit}
              className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98]"
            >
              Submit Rating & Review
            </button>
          </>
        )}
      </div>
    </div>
  );
}
