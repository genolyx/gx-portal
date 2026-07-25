'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
} from '@heroui/react';
import { usersApi, clientsApi, labsApi } from '../../../lib/api/admin';
import { PageHeader } from '../../ui/PageHeader';
import type { UserProfile, UpdateUserDto, Client, Lab } from '@gx-portal/types';

type Role = 'admin' | 'client' | 'lab';

interface FormState {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  client_id?: number;
  lab_id?: number;
  password: string;
  email_notification: boolean;
}

export function UserFormPage({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);

  const [form, setForm] = useState<FormState>({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'client',
    client_id: undefined,
    lab_id: undefined,
    password: '',
    email_notification: false,
  });

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
    labsApi.list().then(setLabs).catch(() => {});

    usersApi
      .getById(Number(id))
      .then((u: UserProfile) => {
        setForm({
          username: u.username,
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          email: u.email ?? '',
          role: u.role as Role,
          client_id: u.client_id,
          lab_id: u.lab_id,
          password: '',
          email_notification: u.email_notification,
        });
      })
      .catch(() => router.push('/admin/users'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const setRole = (role: Role) => {
    setForm((p) => ({ ...p, role, client_id: undefined, lab_id: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const dto: UpdateUserDto = {
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
        role: form.role,
        client_id: form.role === 'client' ? form.client_id : undefined,
        lab_id: form.role === 'lab' ? form.lab_id : undefined,
        email_notification: form.email_notification,
        password: form.password || undefined,
      };
      await usersApi.update(Number(id), dto);
      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-8 text-center text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        title="Update User"
        description={`Update user "${form.username}"`}
        backHref="/admin/users"
      />

      <Card className="max-w-2xl">
        <Card.Content>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="col-span-full flex flex-col gap-1.5">
                <Label>
                  Username <span className="text-danger">*</span>
                </Label>
                <Input
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  required
                  disabled
                  fullWidth
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  First Name <span className="text-danger">*</span>
                </Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  fullWidth
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Last Name <span className="text-danger">*</span>
                </Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  fullWidth
                />
              </div>

              <div className="col-span-full flex flex-col gap-1.5">
                <Label>
                  Email <span className="text-danger">*</span>
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  fullWidth
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Role <span className="text-danger">*</span>
                </Label>
                <Select
                  selectedKey={form.role}
                  onSelectionChange={(key) => setRole(key as Role)}
                  fullWidth
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="admin" textValue="Administrator">
                        Administrator
                      </ListBox.Item>
                      <ListBox.Item id="client" textValue="Client">
                        Client
                      </ListBox.Item>
                      <ListBox.Item id="lab" textValue="Lab">
                        Lab
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {form.role === 'client' && (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Client <span className="text-danger">*</span>
                  </Label>
                  <Select
                    selectedKey={form.client_id != null ? String(form.client_id) : null}
                    onSelectionChange={(key) =>
                      set('client_id', key ? Number(key) : undefined)
                    }
                    fullWidth
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {clients.map((c) => (
                          <ListBox.Item key={c.id} id={String(c.id)} textValue={c.name}>
                            {c.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}

              {form.role === 'lab' && (
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Lab <span className="text-danger">*</span>
                  </Label>
                  <Select
                    selectedKey={form.lab_id != null ? String(form.lab_id) : null}
                    onSelectionChange={(key) => set('lab_id', key ? Number(key) : undefined)}
                    fullWidth
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {labs.map((l) => (
                          <ListBox.Item
                            key={l.id}
                            id={String(l.id)}
                            textValue={l.client_name ? `${l.name} (${l.client_name})` : l.name}
                          >
                            {l.name}
                            {l.client_name ? ` (${l.client_name})` : ''}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Leave blank to keep current"
                  fullWidth
                />
              </div>
            </div>

            <Switch
              isSelected={form.email_notification}
              onChange={(v) => set('email_notification', v)}
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Email Notification
              </Switch.Content>
            </Switch>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" variant="primary" isDisabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button type="button" variant="ghost" onPress={() => router.push('/admin/users')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
