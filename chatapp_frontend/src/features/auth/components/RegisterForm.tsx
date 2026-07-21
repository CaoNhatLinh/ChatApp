import React from "react";
import { Link } from "react-router-dom";
import { User, Lock, UserCircle, UserPlus, ArrowLeft } from "lucide-react";
import { useRegisterForm } from "../hooks/useRegisterForm";
import { AuthField } from "@/features/auth/ui/components/AuthField";

export const RegisterForm: React.FC = () => {
  const {
    display_name,
    setDisplayName,
    username,
    setUsername,
    password,
    setPassword,
    onSubmit,
    loading,
    error,
  } = useRegisterForm();

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <AuthField
        label="Ho va ten"
        icon={<UserCircle size={18} />}
        value={display_name}
        onValueChange={(e) => setDisplayName(e.target.value)}
        disabled={loading}
        required
        placeholder="Nhap ten hien thi"
      />

      <AuthField
        label="Ten dang nhap"
        icon={<User size={18} />}
        value={username}
        onValueChange={(e) => setUsername(e.target.value)}
        disabled={loading}
        required
        placeholder="Ten dang nhap mong muon"
      />

      <AuthField
        label="Mat khau"
        icon={<Lock size={18} />}
        inputType="password"
        value={password}
        onValueChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        required
        placeholder="Tao mat khau it nhat 8 ky tu"
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
            <span>Tao tai khoan</span>
            <UserPlus size={18} />
          </>
        )}
      </button>

      <div className="pt-2 text-center">
        <Link
          to="/login"
          className="text-muted-foreground font-bold hover:text-foreground transition-colors flex items-center justify-center gap-2 w-full text-xs uppercase tracking-[0.16em]"
        >
          <ArrowLeft size={14} />
          Quay lai dang nhap
        </Link>
      </div>
    </form>
  );
};

export default RegisterForm;
