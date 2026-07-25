'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
} from '@heroui/react';
import { labsApi, clientsApi } from '../../../lib/api/admin';
import { systemApi } from '../../../lib/api/system';
import { LabeledCheckbox } from '../../ui/LabeledCheckbox';
import type { Client, CreateLabDto } from '@gx-portal/types';

const EMPTY_FORM: CreateLabDto = {
  name: '',
  address: '',
  email: '',
  phone: '',
  client_id: undefined,
  service_codes: [],
};

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreateLabModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [form, setForm] = useState<CreateLabDto>(EMPTY_FORM);

  useEffect(() => {
    clientsApi.list().then(setClients).catch(() => {});
    systemApi
      .services()
      .then((svcs: unknown) => {
        if (Array.isArray(svcs)) {
          setAvailableServices((svcs as { code: string }[]).map((s) => s.code));
        }
      })
      .catch(() => {});
  }, []);

  const set = <K extends keyof CreateLabDto>(k: K, v: CreateLabDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleService = (code: string, checked: boolean) => {
    const current = form.service_codes ?? [];
    set(
      'service_codes',
      checked ? [...current, code] : current.filter((s) => s !== code),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await labsApi.create(form);
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
              <Modal.Heading>Create Lab</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <form onSubmit={handleSubmit}>
              <Modal.Body>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>
                      Lab Name <span className="text-danger">*</span>
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      required
                      fullWidth
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>
                      Address <span className="text-danger">*</span>
                    </Label>
                    <Input
                      value={form.address ?? ''}
                      onChange={(e) => set('address', e.target.value)}
                      fullWidth
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>
                      Email <span className="text-danger">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={form.email ?? ''}
                      onChange={(e) => set('email', e.target.value)}
                      fullWidth
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>
                      Phone Number <span className="text-danger">*</span>
                    </Label>
                    <Input
                      value={form.phone ?? ''}
                      onChange={(e) => set('phone', e.target.value)}
                      fullWidth
                    />
                  </div>

                  <div className="col-span-full flex flex-col gap-1.5">
                    <Label>
                      Clients <span className="text-danger">*</span>
                    </Label>
                    <Select
                      selectedKey={form.client_id != null ? String(form.client_id) : null}
                      onSelectionChange={(key) =>
                        set('client_id', key ? Number(key) : undefined)
                      }
                      fullWidth
                      aria-label="Clients"
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
                </div>

                {availableServices.length > 0 && (
                  <div className="mt-5">
                    <Label>Allowed Services</Label>
                    <p className="mt-1 text-xs text-muted">Leave empty to allow all services.</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {availableServices.map((code) => (
                        <LabeledCheckbox
                          key={code}
                          isSelected={(form.service_codes ?? []).includes(code)}
                          onChange={(checked) => toggleService(code, checked)}
                        >
                          {code}
                        </LabeledCheckbox>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="mt-4 text-sm text-danger">{error}</p>}
              </Modal.Body>

              <Modal.Footer>
                <Button type="button" variant="ghost" onPress={onClose} isDisabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isDisabled={saving}>
                  {saving ? 'Creating…' : 'Create Lab'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
