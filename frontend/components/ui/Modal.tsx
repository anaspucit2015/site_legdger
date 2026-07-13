'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 440 }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(27,58,92,0.35)' }}
        />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] rounded-2xl shadow-2xl focus:outline-none"
          style={{ background: 'white', maxWidth, padding: '28px' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title
                className="text-lg font-bold"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy)' }}
              >
                {title}
              </Dialog.Title>
              {subtitle && (
                <Dialog.Description className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
