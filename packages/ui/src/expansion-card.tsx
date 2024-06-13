import * as React from "react";

import { cn } from "./utils";

const ExpansionCardContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

const useExpansionCardContext = () => React.useContext(ExpansionCardContext);

const ExpansionCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(({ className, open, onOpenChange, ...props }, ref) => {
  const [isOpen, setOpen] = React.useState(false);

  return (
    <ExpansionCardContext.Provider
      value={{
        open: open ?? isOpen,
        onOpenChange: onOpenChange ?? setOpen,
      }}
    >
      <div ref={ref} className={className} {...props} />
    </ExpansionCardContext.Provider>
  );
});
ExpansionCard.displayName = "ExpansionCard";

const ExpansionCardTrigger = React.forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { onOpenChange } = useExpansionCardContext();
  return (
    <button
      ref={ref}
      className={className}
      onClick={() => onOpenChange(true)}
      {...props}
    />
  );
});
ExpansionCardTrigger.displayName = "ExpansionCardTrigger";

const ExpansionCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
ExpansionCardHeader.displayName = "ExpansionCardHeaderHeader";

const ExpansionCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
ExpansionCardTitle.displayName = "ExpansionCardTitle";

const ExpansionCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ExpansionCardDescription.displayName = "ExpansionCardDescription";

const ExpansionCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open, onOpenChange } = useExpansionCardContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

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
ExpansionCardContent.displayName = "ExpansionCardContent";

const ExpansionCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
ExpansionCardFooter.displayName = "ExpansionCardFooter";

export {
  ExpansionCard,
  ExpansionCardContent,
  ExpansionCardDescription,
  ExpansionCardFooter,
  ExpansionCardHeader,
  ExpansionCardTitle,
  ExpansionCardTrigger,
};
