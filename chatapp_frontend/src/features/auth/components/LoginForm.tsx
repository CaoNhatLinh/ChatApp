import React from "react";
import Link from "next/link";
import { User, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import { useLoginForm } from "../hooks/useLoginForm";
import { AuthField } from "@/features/auth/ui/components/AuthField";
import { localizeText } from "@/shared/i18n";

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
        label={localizeText("Tên đăng nhập")}
        icon={<User size={18} />}
        autoComplete="username"
        value={username}
        onValueChange={(e) => setUsername(e.target.value)}
        disabled={loading}
        required
        placeholder={localizeText("Nhập tên đăng nhập")}
      />

      <AuthField
        label={localizeText("Mật khẩu")}
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
            className="focus-ring text-muted-foreground hover:text-foreground transition-colors"
            aria-label={localizeText(showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu")}
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
        className="focus-ring flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-primary py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px disabled:opacity-55"
      >
        {loading ? (
          <div className="w-5 h-5 border-3 border-primary-foreground/35 border-t-primary-foreground rounded-full animate-spin" />
        ) : (
          <>
            <span>{localizeText("Đăng nhập")}</span>
            <LogIn size={18} />
          </>
        )}
      </button>

      <div className="pt-4 text-center">
        <p className="text-xs text-muted-foreground font-medium">
          {localizeText("Chưa có tài khoản?")} {" "}
          <Link href="/register" className="text-primary font-bold hover:underline">
            {localizeText("Tạo ngay")}
          </Link>
        </p>
      </div>
    </form>
  );
};

export default LoginForm;

