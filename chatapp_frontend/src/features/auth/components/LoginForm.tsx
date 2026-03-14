import React from 'react';
import { User, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { useLoginForm } from '../hooks/useLoginForm';

export const LoginForm: React.FC = () => {
    const {
        username, setUsername,
        password, setPassword,
        showPassword, setShowPassword,
        onSubmit, loading, error
    } = useLoginForm();

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2 group">
                <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground/80 ml-1">
                    Username
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <User size={18} />
                    </div>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        required
                        placeholder="Tên đăng nhập của bạn..."
                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:ring-0 focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/40 outline-none"
                    />
                </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2 group">
                <div className="flex justify-between items-center px-1">
                    <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground/80">
                        Password
                    </label>
                    <button type="button" className="text-[10px] uppercase font-bold text-primary hover:underline">
                        Quên mật khẩu?
                    </button>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Lock size={18} />
                    </div>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                        placeholder="••••••••"
                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-3 pl-12 pr-12 focus:ring-0 focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/40 outline-none"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-destructive/10 border-l-4 border-destructive p-3 rounded-r-xl animate-in fade-in slide-in-from-left-2">
                    <p className="text-xs font-bold text-destructive">{error}</p>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-2xl neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-3 overflow-hidden group"
            >
                {loading ? (
                    <div className="w-6 h-6 border-4 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                    <>
                        <span>Login Now</span>
                        <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>

            {/* Secondary Actions */}
            <div className="pt-4 text-center">
                <p className="text-xs text-muted-foreground font-medium">
                    Chưa có tài khoản?{' '}
                    <button
                        type="button"
                        className="text-primary font-bold hover:underline"
                        onClick={() => window.location.href = '/register'}
                    >
                        ĐĂNG KÝ NGAY
                    </button>
                </p>
            </div>
        </form>
    );
};

export default LoginForm;
