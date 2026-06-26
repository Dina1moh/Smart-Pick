import { Star } from "lucide-react";

interface Props {
  stars: number | null;
  size?: number;
  showValue?: boolean;
}

export default function StarRating({ stars, size = 16, showValue = true }: Props) {
  if (stars === null) {
    return <span className="text-xs text-[var(--color-muted)]">No rating</span>;
  }
  const rounded = Math.round(stars);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            strokeWidth={2}
            className={
              i < rounded
                ? "fill-[#FFB400] text-[#FFB400]"
                : "fill-transparent text-[var(--color-border)]"
            }
          />
        ))}
      </span>
      {showValue && (
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {stars.toFixed(1)}
        </span>
      )}
    </span>
  );
}
