interface MessengerErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const MessengerErrorState = ({ error, onRetry }: MessengerErrorStateProps) => {
  return (
    <div className="flex h-full min-h-[520px] w-full items-center justify-center bg-background p-6">
      <div className="product-surface max-w-sm border-destructive/30 p-8">
        <h2 className="mb-4 text-xl font-semibold text-destructive">Không thể mở workspace</h2>
        <p className="mb-6 text-sm leading-6 text-muted-foreground">{error}</p>
        <button onClick={onRetry} className="focus-ring rounded-[var(--radius-md)] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" type="button">Tải lại</button>
      </div>
    </div>
  );
};

export default MessengerErrorState;
