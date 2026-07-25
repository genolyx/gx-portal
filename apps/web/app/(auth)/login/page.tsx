'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Form, Input, Label } from '@heroui/react';
import { authApi } from '../../../lib/api/auth';

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
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-[360px]">
        <Card.Header>
          <div className="flex items-center gap-2.5">
            <span className="text-[28px] leading-none">⬡</span>
            <Card.Title>Gx-Portal</Card.Title>
          </div>
          <Card.Description>Genolyx Analysis Portal</Card.Description>
        </Card.Header>
        <Card.Content>
          <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                fullWidth
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
                fullWidth
              />
            </div>

            {error && (
              <Alert status="danger">
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isDisabled={loading}
              fullWidth
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
}
