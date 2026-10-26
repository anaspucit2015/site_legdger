export const metadata = {
  title: 'Offline — SiteLedger',
};

export default function OfflinePage() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="card px-8 py-10 text-center max-w-sm">
        <h1 className="text-lg font-semibold mb-2">You&apos;re offline</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Connect to the internet to load this page. Pages you&apos;ve already
          visited may still be available.
        </p>
      </div>
    </div>
  );
}
