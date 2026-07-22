'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../lib/api/auth';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import { Button } from '../../../components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login(username, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gx-bg">
      <div className="w-[360px] bg-gx-surface border border-gx-border rounded-gx-lg shadow-gx-md p-10">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-[28px] text-gx-accent leading-none">⬡</span>
          <span className="text-[22px] font-bold text-gx-text">Gx-Portal</span>
        </div>
        <p className="text-xs text-gx-text-2 mb-7">Genolyx Analysis Portal</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-xs text-gx-danger bg-gx-danger/10 rounded-gx-sm px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full mt-1"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}
