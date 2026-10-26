'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstallEvent(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (!installEvent || dismissed) return null;

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstallEvent(null);
  }

  return (
    <div
      className="card fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3"
      style={{ boxShadow: '0 12px 32px rgba(27,58,92,0.18)' }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Install SiteLedger
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Add to your home screen for quick access
        </p>
      </div>
      <button className="btn-primary flex items-center gap-1.5 shrink-0" onClick={handleInstall}>
        <Download size={14} />
        Install
      </button>
      <button
        aria-label="Dismiss install prompt"
        className="shrink-0"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setDismissed(true)}
      >
        <X size={16} />
      </button>
    </div>
  );
}
