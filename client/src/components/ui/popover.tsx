import * as React from "react";
import {
  Anchor,
  Content,
  Portal,
  Root,
  Trigger,
} from "@radix-ui/react-popover";

import { cn } from "../../lib/utils";

const Popover = Root;

const PopoverTrigger = Trigger;

const PopoverAnchor = Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof Content>,
  React.ComponentPropsWithoutRef<typeof Content>
>(({ className, align = "start", sideOffset = 6, ...props }, ref) => (
  <Portal>
    <Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-auto rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg outline-none",
        className,
      )}
      {...props}
    />
  </Portal>
));
PopoverContent.displayName = Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
