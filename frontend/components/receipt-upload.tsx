'use client';
import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { useGetPresignedUrlMutation } from '@/lib/api/uploadsApi';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  onUploadComplete: (url: string) => void;
  onClear?: () => void;
}

export function ReceiptUpload({ onUploadComplete, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [getPresignedUrl] = useGetPresignedUrlMutation();

  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File must be under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      // 1 — get presigned URL from our backend
      const { presignedUrl, objectUrl } = await getPresignedUrl({
        fileName: file.name,
        fileType: file.type,
      }).unwrap();

      // 2 — PUT directly to R2 (bytes never touch our server)
      const res = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!res.ok) throw new Error('Upload failed');

      setPreview(URL.createObjectURL(file));
      onUploadComplete(objectUrl);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleClear() {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onClear?.();
  }

  return (
    <div>
      <p
        className="block text-sm font-medium mb-1.5"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
      >
        Receipt Photo <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
      </p>

      {preview ? (
        /* ── Uploaded thumbnail ── */
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Receipt preview"
            className="rounded-xl object-cover"
            style={{ width: 120, height: 120, border: '2px solid var(--border)' }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--rust)', color: 'white' }}
            aria-label="Remove receipt"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        /* ── Drop zone ── */
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-colors"
          style={{
            border: `1.5px dashed ${error ? 'var(--rust)' : 'var(--border)'}`,
            background: error ? '#fdf0ed' : '#f5f6fa',
            padding: '20px 16px',
          }}
          onMouseEnter={(e) => { if (!error) (e.currentTarget as HTMLDivElement).style.background = '#eef0f8'; }}
          onMouseLeave={(e) => { if (!error) (e.currentTarget as HTMLDivElement).style.background = '#f5f6fa'; }}
        >
          {uploading ? (
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--navy)' }} />
          ) : (
            <ImagePlus size={22} style={{ color: error ? 'var(--rust)' : 'var(--text-muted)' }} />
          )}
          <p className="text-xs text-center" style={{ color: error ? 'var(--rust)' : 'var(--text-muted)' }}>
            {uploading
              ? 'Uploading…'
              : error
              ? error
              : <>Click or drag to attach receipt<br /><span style={{ opacity: 0.7 }}>JPEG · PNG · WebP · max 5 MB</span></>}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
