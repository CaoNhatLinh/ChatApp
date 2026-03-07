import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export const MainLayout = ({ children, className }: Props) => {
  return (
    <div className={cn(
      "h-screen w-screen text-foreground bg-background flex flex-col overflow-hidden",
      className
    )}>
      {children}
    </div>
  );
};