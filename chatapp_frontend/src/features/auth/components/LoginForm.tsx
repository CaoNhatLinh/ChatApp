import React, { useState } from "react";
import Link from "next/link";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useLoginForm } from "../hooks/useLoginForm";
import { AuthField } from "@/features/auth/ui/components/AuthField";
import { localizeText } from "@/shared/i18n";
import { Button } from "@/shared/ui/Button";
import { GoogleAuthPanel } from './GoogleAuthPanel';

export const LoginForm: React.FC = () => {
  const [googleOnboarding, setGoogleOnboarding] = useState(false);
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
    <div className="space-y-5">
      {!googleOnboarding ? (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
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
        placeholder={localizeText("Nhập mật khẩu")}
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

      <Button
        type="submit"
        loading={loading}
        className="h-12 w-full"
      >
        {loading ? localizeText("Đang đăng nhập...") : localizeText("Đăng nhập")}
      </Button>

      <div className="pt-3 text-center">
        <p className="text-xs text-muted-foreground font-medium">
          {localizeText("Chưa có tài khoản?")} {" "}
          <Link href="/register" className="text-primary font-bold hover:underline">
            {localizeText("Tạo ngay")}
          </Link>
        </p>
      </div>
        </form>
      ) : null}
      <GoogleAuthPanel onOnboardingChange={setGoogleOnboarding} />
    </div>
  );
};

export default LoginForm;

