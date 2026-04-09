import { Check } from "lucide-react";

type VerifiedBadgeProps = {
  className?: string;
};

export const VerifiedBadge = ({ className = "" }: VerifiedBadgeProps) => {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full align-middle ${className}`.trim()}
      style={{ backgroundColor: "#1DA1F2" }}
      aria-label="Verified admin account"
      title="Verified admin"
    >
      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
    </span>
  );
};

