// DonutChart: a ring split into coloured parts, with a number in the middle.
// Used for the share of conditions met / not met / needing review.
//
// The chart is decorative (aria-hidden): the same numbers are always written
// out next to it, so nothing depends on seeing the colours.
type Segment = { value: number; color: string };

type DonutChartProps = {
  segments: Segment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
};

export default function DonutChart({ segments, centerValue, centerLabel, size = 148 }: DonutChartProps) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const gap = total > 1 ? 3 : 0; // a small white gap between parts

  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-surface-subtle)" strokeWidth={stroke} />
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment, index) => {
              const length = (segment.value / total) * circumference;
              const circle = (
                <circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${Math.max(length - gap, 0)} ${circumference}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += length;
              return circle;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Smaller text for a small chart, so it fits inside the ring. */}
        <span
          className={`font-semibold tracking-tight text-fg tabular-nums ${size < 110 ? "text-base" : "text-2xl"}`}
        >
          {centerValue}
        </span>
        <span className={`font-medium text-fg-4 ${size < 110 ? "text-[10px]" : "text-xs"}`}>{centerLabel}</span>
      </div>
    </div>
  );
}

// The colours used for each verdict in charts, matching StatusLabel.
export const VERDICT_COLORS = {
  met: "#16a34a",
  not_met: "#dc2626",
  needs_review: "#f59e0b",
};
