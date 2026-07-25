'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Switch,
} from '@heroui/react';
import { usersApi, clientsApi, labsApi } from '../../../lib/api/admin';
import type { CreateUserDto, Client, Lab } from '@gx-portal/types';

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

const EMPTY_FORM: FormState = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  role: 'client',
  client_id: undefined,
  lab_id: undefined,
  password: '',
  email_notification: false,
};

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreateUserModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
    labsApi.list().then(setLabs).catch(() => {});
  }, []);

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
      const dto: CreateUserDto = {
        username: form.username,
        password: form.password,
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
        role: form.role,
        client_id: form.role === 'client' ? form.client_id : undefined,
        lab_id: form.role === 'lab' ? form.lab_id : undefined,
        email_notification: form.email_notification,
      };
      await usersApi.create(dto);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-full max-w-2xl max-h-[90vh]">
            <Modal.Header>
              <Modal.Heading>Create User</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <form onSubmit={handleSubmit}>
              <Modal.Body>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="col-span-full flex flex-col gap-1.5">
                    <Label>
                      Username <span className="text-danger">*</span>
                    </Label>
                    <Input
                      value={form.username}
                      onChange={(e) => set('username', e.target.value)}
                      required
                      fullWidth
                      autoFocus
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
                      aria-label="Role"
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
                        aria-label="Client"
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
                        aria-label="Lab"
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
                    <Label>
                      Password <span className="text-danger">*</span>
                    </Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      required
                      fullWidth
                    />
                  </div>
                </div>

                <div className="mt-5">
                  <Switch
                    isSelected={form.email_notification}
                    onChange={(v) => set('email_notification', v)}
                    className="!flex-row !items-center"
                  >
                    <Switch.Content className="!flex-row !items-center !gap-2">
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <span className="text-sm">Email Notification</span>
                    </Switch.Content>
                  </Switch>
                </div>

                {error && <p className="mt-4 text-sm text-danger">{error}</p>}
              </Modal.Body>

              <Modal.Footer>
                <Button type="button" variant="ghost" onPress={onClose} isDisabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isDisabled={saving}>
                  {saving ? 'Creating…' : 'Create User'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
