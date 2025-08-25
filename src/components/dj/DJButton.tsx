import { cn } from "@/lib/utils";

interface DJButtonProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  variant?: "default" | "cue" | "play" | "sync";
  size?: "sm" | "md" | "lg";
}

export const DJButton = ({ 
  label, 
  active = false, 
  onClick,
  variant = "default",
  size = "md"
}: DJButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "dj-button",
        active && "active",
        variant === "cue" && "cue",
        variant === "play" && "play", 
        variant === "sync" && "sync",
        size === "sm" && "px-2 py-1 text-xs",
        size === "lg" && "px-6 py-3 text-base"
      )}
    >
      {label}
    </button>
  );
};