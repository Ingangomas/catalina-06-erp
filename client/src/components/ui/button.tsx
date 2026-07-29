import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-[-0.015em] transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-[#1d2a45] text-white shadow-[0_10px_24px_rgba(29,42,69,0.18)] hover:bg-[#2b3c60] hover:shadow-[0_14px_28px_rgba(29,42,69,0.22)]",
        destructive: "bg-destructive text-white shadow-[0_10px_24px_rgba(190,70,63,0.18)] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "border border-white/80 bg-white/58 text-[#293752] shadow-[0_6px_20px_rgba(37,50,78,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl hover:border-white hover:bg-white/82 hover:text-[#17233d] dark:bg-transparent dark:border-input dark:hover:bg-input/50",
        secondary: "bg-[#eef2ff] text-[#4059a9] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-[#e2e9ff]",
        ghost: "text-[#4c5d7d] hover:bg-white/60 hover:text-[#1d2a45]",
        glass: "border border-white/65 bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.20)] backdrop-blur-xl hover:bg-white/25",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
