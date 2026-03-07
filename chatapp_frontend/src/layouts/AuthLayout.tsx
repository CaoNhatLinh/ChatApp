import React from "react";
import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  children: React.ReactNode;
  title?: string;
}

export const AuthLayout = ({ children, title }: Props) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-50 to-background dark:from-slate-900 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <Card className="shadow-2xl shadow-primary/5 border-muted bg-background/80 backdrop-blur-xl">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="flex items-center justify-center">
              <div className="bg-primary/10 rounded-2xl p-4 shadow-inner">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl">ChatApp</CardTitle>
              {title && (
                <CardDescription className="text-sm mt-2">{title}</CardDescription>
              )}
            </div>
          </CardHeader>

          <CardContent className="pb-8">
            {children}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-6">
          © {new Date().getFullYear()} ChatApp. All rights reserved.
        </div>
      </div>
    </div>
  );
};
