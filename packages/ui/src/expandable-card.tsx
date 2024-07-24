import * as React from "react";

import { cn } from "./utils";

const ExpandableCardContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

const useExpandableCardContext = () => React.useContext(ExpandableCardContext);

const ExpandableCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(({ className, open, onOpenChange, ...props }, ref) => {
  const [isOpen, setOpen] = React.useState(false);

  return (
    <ExpandableCardContext.Provider
      value={{
        open: open ?? isOpen,
        onOpenChange: onOpenChange ?? setOpen,
      }}
    >
      <div ref={ref} className={className} {...props} />
    </ExpandableCardContext.Provider>
  );
});
ExpandableCard.displayName = "ExpandableCard";

const ExpandableCardTrigger = React.forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = useExpandableCardContext();
  return (
    <button
      ref={ref}
      className={className}
      {...props}
      onClick={() => onOpenChange(true)}
    />
  );
});
ExpandableCardTrigger.displayName = "ExpandableCardTrigger";

const ExpandableCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
ExpandableCardHeader.displayName = "ExpandableCardHeaderHeader";

const ExpandableCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
ExpandableCardTitle.displayName = "ExpandableCardTitle";

const ExpandableCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ExpandableCardDescription.displayName = "ExpandableCardDescription";

const ExpandableCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open, onOpenChange } = useExpandableCardContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: More control is needed here
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!contentRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [open, onOpenChange]);

  return (
    <div
      ref={contentRef}
      className={cn(
        "absolute -left-[128px] top-0 z-10 w-[600px] cursor-default rounded-xl border bg-card p-6 pt-0 text-card-foreground shadow",
        className,
        {
          hidden: !open,
        },
      )}
      {...props}
    />
  );
});
ExpandableCardContent.displayName = "ExpandableCardContent";

const ExpandableCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
ExpandableCardFooter.displayName = "ExpandableCardFooter";

export {
  ExpandableCard,
  ExpandableCardContent,
  ExpandableCardDescription,
  ExpandableCardFooter,
  ExpandableCardHeader,
  ExpandableCardTitle,
  ExpandableCardTrigger,
};
