import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  wordmark = true,
  size = 28,
}: {
  className?: string;
  wordmark?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-foreground" />
        <path
          className="fill-background"
          d="M8.2 16.1 23.6 8.7c.85-.4 1.7.45 1.3 1.3l-7.6 14.8c-.38.74-1.45.62-1.64-.18l-1.5-6.4-6.4-1.48c-.8-.19-.9-1.26-.16-1.64Z"
        />
      </svg>
      {wordmark && (
        <span className="text-[17px] font-semibold leading-none tracking-[-0.03em] text-foreground">Pubit</span>
      )}
    </span>
  );
}
