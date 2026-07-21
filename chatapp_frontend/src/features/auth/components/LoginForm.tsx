import React from "react";
import { Link } from "react-router-dom";
import { User, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { useLoginForm } from "../hooks/useLoginForm";
import { AuthField } from "@/features/auth/ui/components/AuthField";

export const LoginForm: React.FC = () => {
  const {
    username,
    setUsername,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    onSubmit,
    loading,
    error,
  } = useLoginForm();

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <AuthField
        label="Ten dang nhap"
        icon={<User size={18} />}
        autoComplete="username"
        value={username}
        onValueChange={(e) => setUsername(e.target.value)}
        disabled={loading}
        required
        placeholder="Nhap ten dang nhap"
      />

      <AuthField
        label="Mat khau"
        icon={<Lock size={18} />}
        inputType={showPassword ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        onValueChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        required
        placeholder="••••••••"
        rightAction={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "An mat khau" : "Hien mat khau"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-destructive">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-primary text-primary-foreground font-black uppercase tracking-[0.12em] rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-55"
      >
        {loading ? (
          <div className="w-5 h-5 border-3 border-primary-foreground/35 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          <>
            <span>Dang nhap</span>
            <LogIn size={18} />
          </>
        )}
      </button>

      <div className="pt-4 text-center">
        <p className="text-xs text-muted-foreground font-medium">
          Chua co tai khoan?{" "}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Tao ngay
          </Link>
        </p>
      </div>
    </form>
  );
};

export default LoginForm;
