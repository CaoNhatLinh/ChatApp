import { type ChangeEventHandler, type InputHTMLAttributes, type ReactNode } from "react";

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  icon: ReactNode;
  inputType?: string;
  rightAction?: ReactNode;
  value: string;
  onValueChange: ChangeEventHandler<HTMLInputElement>;
}

export const AuthField = ({
  label,
  icon,
  inputType = "text",
  rightAction,
  value,
  onValueChange,
  className = "",
  ...props
}: AuthFieldProps) => {
  return (
    <div className="space-y-2 group">
      <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground/90 ml-1">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          {icon}
        </div>
        <input
          type={inputType}
          value={value}
          onChange={onValueChange}
          className={`focus-brand w-full bg-background/50 border border-border rounded-xl py-3 pl-12 pr-12 font-medium text-sm transition-all placeholder:text-muted-foreground/60 ${className}`}
          {...props}
        />
        {rightAction ? (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
            {rightAction}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AuthField;
