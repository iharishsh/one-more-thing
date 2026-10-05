import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  // Keep leading-none on size variants (after text-*), or cn drops it against text-sm.
  "group/button motion-tap box-border inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 font-[family-name:var(--font-plain)] tracking-[-0.02em]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[#222222] active:bg-[#444444]",
        brand:
          "bg-[color:var(--brand)] text-white hover:bg-[#001f66] active:bg-[#001851]",
        outline:
          "border-[color:var(--brand)] bg-card text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]",
        "outline-bright":
          "border-[color:var(--brand-bright)] bg-transparent text-[color:var(--brand-bright)] hover:bg-white/70",
        secondary:
          "border-transparent bg-[color:var(--brand-soft)] text-foreground hover:bg-[#dde3ec]",
        ghost:
          "text-foreground hover:bg-[color:var(--brand-soft)] aria-expanded:bg-[color:var(--brand-soft)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
        link: "rounded-md text-[color:var(--brand)] underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-11 min-h-11 gap-1.5 px-5 text-[0.9375rem] leading-none pt-px",
        xs: "h-8 min-h-8 gap-1 px-3 text-xs leading-none pt-px",
        sm: "h-10 min-h-10 gap-1 px-4 text-sm leading-none pt-px",
        lg: "h-12 min-h-12 gap-2 px-6 text-base leading-none pt-px",
        icon: "size-11 leading-none pt-px",
        "icon-xs": "size-8 leading-none pt-px",
        "icon-sm": "size-10 leading-none pt-px",
        "icon-lg": "size-12 leading-none pt-px",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
