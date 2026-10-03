'use client';

import { useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { isFastqFilename, uploadFastqFile } from '../../../lib/api/browse';

interface Props {
  serviceCode: string;
  onUploaded: (paths: string[]) => void;
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FastqComputerUpload({ serviceCode, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const start = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    if (files.length > 2) {
      setError('Choose one file, or R1 and R2 together.');
      return;
    }
    const bad = files.find((f) => !isFastqFilename(f.name));
    if (bad) {
      setError(`${bad.name} is not a FASTQ (.fastq, .fq, .fastq.gz, .fq.gz).`);
      return;
    }

    setBusy(true);
    setError('');
    const paths: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatus(`Uploading ${file.name} (${i + 1}/${files.length})…`);
        const res = await uploadFastqFile(serviceCode, file, (loaded, total) => {
          const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          setStatus(`Uploading ${file.name} (${i + 1}/${files.length}) ${pct}% · ${formatBytes(loaded)}`);
        });
        paths.push(res.abs_path);
      }
      setStatus(paths.length === 2 ? 'R1 and R2 uploaded.' : 'Uploaded.');
      onUploaded(paths);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStatus('');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".fastq,.fq,.fastq.gz,.fq.gz,application/gzip"
        onChange={(e) => { void start(e.target.files); }}
      />
      <Button
        size="sm"
        variant="secondary"
        isDisabled={busy}
        onPress={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : 'Upload from this computer…'}
      </Button>
      {status && <p className="text-xs text-muted m-0">{status}</p>}
      {error && <p className="text-xs text-danger m-0">{error}</p>}
    </div>
  );
}
