import React from 'react';
import { User, Lock, UserCircle, UserPlus, ArrowLeft } from 'lucide-react';
import { useRegisterForm } from '../hooks/useRegisterForm';

export const RegisterForm: React.FC = () => {
    const {
        display_name, setDisplayName,
        username, setUsername,
        password, setPassword,
        onSubmit, loading, error
    } = useRegisterForm();

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {/* Display Name Field */}
            <div className="space-y-2 group">
                <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground/80 ml-1">
                    Họ và tên
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <UserCircle size={18} />
                    </div>
                    <input
                        type="text"
                        value={display_name}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={loading}
                        required
                        placeholder="Tên hiển thị của bạn..."
                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:ring-0 focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/40 outline-none"
                    />
                </div>
            </div>

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
                        placeholder="Tên đăng nhập mong muốn..."
                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:ring-0 focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/40 outline-none"
                    />
                </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2 group">
                <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground/80 ml-1">
                    Password
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Lock size={18} />
                    </div>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        required
                        placeholder="••••••••"
                        className="w-full bg-background/50 border-2 border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:ring-0 focus:border-primary focus:bg-background transition-all placeholder:text-muted-foreground/40 outline-none"
                    />
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
                className="w-full py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest rounded-2xl neo-shadow hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-3 group mt-4"
            >
                {loading ? (
                    <div className="w-6 h-6 border-4 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                    <>
                        <span>Create Account</span>
                        <UserPlus size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                )}
            </button>

            {/* Secondary Actions */}
            <div className="pt-4 text-center">
                <button
                    type="button"
                    disabled={loading}
                    className="text-muted-foreground font-bold hover:text-foreground transition-colors flex items-center justify-center gap-2 w-full text-xs uppercase tracking-widest"
                    onClick={() => window.location.href = '/login'}
                >
                    <ArrowLeft size={14} />
                    Quay lại Đăng nhập
                </button>
            </div>
        </form>
    );
};

export default RegisterForm;
