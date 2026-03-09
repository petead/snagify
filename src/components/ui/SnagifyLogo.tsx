import Image from "next/image";

interface SnagifyLogoProps {
  size?: "sm" | "lg";
  variant?: "light" | "dark";
  iconOnly?: boolean;
}

export function SnagifyLogo({
  size = "sm",
  variant = "dark",
  iconOnly = false,
}: SnagifyLogoProps) {
  const height = size === "lg" ? 48 : 32;

  const lightFilter = { filter: "brightness(0) invert(1)" };

  if (iconOnly) {
    return (
      <Image
        src="/logo-icon.png"
        alt="Snagify"
        width={height}
        height={height}
        style={variant === "light" ? lightFilter : undefined}
        priority
      />
    );
  }

  return (
    <Image
      src="/logo-full.png"
      alt="Snagify"
      width={size === "lg" ? 160 : 120}
      height={height}
      style={
        variant === "light"
          ? { height, width: "auto", ...lightFilter }
          : { height, width: "auto" }
      }
      priority
    />
  );
}
