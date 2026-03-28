interface Props {
  isOnline: boolean;
}

export default function ConnectionStatus({ isOnline }: Props) {
  if (isOnline) return null;
  return (
    <div
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
      style={{ background: 'var(--ocre)', color: 'var(--terre)' }}
    >
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span>Hors ligne</span>
    </div>
  );
}
