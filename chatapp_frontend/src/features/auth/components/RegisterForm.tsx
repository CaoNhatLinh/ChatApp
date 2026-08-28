import React from "react";
import Link from "next/link";
import { User, Lock, UserCircle, UserPlus, ArrowLeft, Mail } from "lucide-react";
import { useRegisterForm } from "../hooks/useRegisterForm";
import { AuthField } from "@/features/auth/ui/components/AuthField";
import { localizeText } from "@/shared/i18n";

export const RegisterForm: React.FC = () => {
  const {
    displayName,
    setDisplayName,
    username,
    setUsername,
    email,
    setEmail,
    password,
    setPassword,
    onSubmit,
    loading,
    error,
  } = useRegisterForm();

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthField
        label={localizeText("Họ và tên")}
        icon={<UserCircle size={18} />}
        value={displayName}
        onValueChange={(e) => setDisplayName(e.target.value)}
        disabled={loading}
        required
        autoComplete="name"
        placeholder={localizeText("Nhập tên hiển thị")}
      />

      <AuthField
        label={localizeText("Email")}
        icon={<Mail size={18} />}
        inputType="email"
        value={email}
        onValueChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        required
        autoComplete="email"
        placeholder="ban@example.com"
      />

      <AuthField
        label={localizeText("Tên đăng nhập")}
        icon={<User size={18} />}
        value={username}
        onValueChange={(e) => setUsername(e.target.value)}
        disabled={loading}
        required
        minLength={3}
        autoComplete="username"
        placeholder={localizeText("Tên đăng nhập mong muốn")}
      />

      <AuthField
        label={localizeText("Mật khẩu")}
        icon={<Lock size={18} />}
        inputType="password"
        value={password}
        onValueChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        required
        minLength={8}
        autoComplete="new-password"
        placeholder={localizeText("Tạo mật khẩu ít nhất 8 ký tự")}
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
            <span>{localizeText("Tạo tài khoản")}</span>
            <UserPlus size={18} />
          </>
        )}
      </button>

      <div className="pt-2 text-center">
        <Link
          href="/login"
          className="focus-ring flex w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          {localizeText("Quay lại đăng nhập")}
        </Link>
      </div>
    </form>
  );
};

export default RegisterForm;

