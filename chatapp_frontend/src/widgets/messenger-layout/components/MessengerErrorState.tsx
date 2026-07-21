interface MessengerErrorStateProps {
  error: string;
  onRetry: () => void;
}

export const MessengerErrorState = ({ error, onRetry }: MessengerErrorStateProps) => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-destructive/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-destructive/5 rounded-full blur-[120px]" />
      </div>

      <div className="surface-elevated p-8 rounded-[1.25rem] border border-destructive/20 text-center max-w-sm z-10">
        <h2 className="text-xl font-black uppercase text-destructive mb-4">Khong the khoi tao</h2>
        <p className="text-sm font-medium mb-6 text-muted-foreground">{error}</p>
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-primary text-primary-foreground font-black uppercase rounded-xl"
        >
          Tai lai
        </button>
      </div>
    </div>
  );
};

export default MessengerErrorState;
