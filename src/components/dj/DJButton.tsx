import { cn } from "@/lib/utils";

interface DJButtonProps {
  id?: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
  variant?: "default" | "cue" | "play" | "sync";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export const DJButton = ({ 
  id,
  label, 
  active = false, 
  onClick,
  variant = "default",
  size = "md",
  disabled = false
}: DJButtonProps) => {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "dj-button",
        active && "active",
        variant === "cue" && "cue",
        variant === "play" && "play", 
        variant === "sync" && "sync",
        size === "sm" && "px-2 py-1 text-xs",
        size === "lg" && "px-6 py-3 text-base",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
};