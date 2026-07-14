import type { SVGProps } from "react";

export type IconName =
  | "upload"
  | "evidence"
  | "reset"
  | "target"
  | "pulse"
  | "warning"
  | "check";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "upload":
      return <svg {...commonProps}><path d="M12 16V4m0 0 4 4m-4-4L8 8" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>;
    case "evidence":
      return <svg {...commonProps}><path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.4" /></svg>;
    case "reset":
      return <svg {...commonProps}><path d="M4 7v5h5" /><path d="M5.6 16a8 8 0 1 0 .2-8.2L4 10" /></svg>;
    case "target":
      return <svg {...commonProps}><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>;
    case "pulse":
      return <svg {...commonProps}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>;
    case "warning":
      return <svg {...commonProps}><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4m0 3h.01" /></svg>;
    case "check":
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
  }
}
