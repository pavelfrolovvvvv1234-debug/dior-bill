export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs text-muted-foreground">
        <span className="bg-card px-2">{label}</span>
      </div>
    </div>
  );
}
