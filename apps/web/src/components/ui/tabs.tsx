import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex min-w-0 flex-col gap-6", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex w-fit max-w-full items-center justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1.5 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("min-w-0 flex-1", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
