export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const cls = ['mx-auto w-full max-w-[1600px] space-y-6 p-6', className].filter(Boolean).join(' ');
  return <div className={cls}>{children}</div>;
}
