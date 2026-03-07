import React from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AuthLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden px-4">
            {/* Decorative Blur Backgrounds */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-foreground/20 rounded-full blur-[120px] animate-pulse delay-700" />

            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Brand Header Removed */}

                {/* Content Card */}
                <div className="glass p-8 rounded-[2rem] neo-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

                    <div className="mb-8">
                        {title && <h2 className="text-2xl font-bold mb-1">{title}</h2>}
                        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
                    </div>

                    {children}
                </div>

                {/* Footer Removed */}
            </div>
        </div>
    );
};

export default AuthLayout;
