import { useId, type ChangeEventHandler, type InputHTMLAttributes, type ReactNode } from "react";

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
  id,
  className = "",
  ...props
}: AuthFieldProps) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className="space-y-2 group">
      <label htmlFor={fieldId} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          {icon}
        </div>
        <input
          id={fieldId}
          type={inputType}
          value={value}
          onChange={onValueChange}
          className={`focus-ring h-11 w-full rounded-[var(--radius-md)] border border-border bg-background py-3 pl-11 pr-12 text-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] placeholder:text-muted-foreground ${className}`}
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

