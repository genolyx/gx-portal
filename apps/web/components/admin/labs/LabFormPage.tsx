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
} from '@heroui/react';
import { labsApi, clientsApi } from '../../../lib/api/admin';
import { systemApi } from '../../../lib/api/system';
import { LabeledCheckbox } from '../../ui/LabeledCheckbox';
import { PageHeader } from '../../ui/PageHeader';
import type { Lab, CreateLabDto, Client } from '@gx-portal/types';

function ServiceCheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (code: string, checked: boolean) => {
    onChange(checked ? [...selected, code] : selected.filter((s) => s !== code));
  };

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {options.map((code) => (
        <LabeledCheckbox
          key={code}
          isSelected={selected.includes(code)}
          onChange={(checked) => toggle(code, checked)}
        >
          {code}
        </LabeledCheckbox>
      ))}
    </div>
  );
}

export function LabFormPage({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  const [form, setForm] = useState<CreateLabDto>({
    name: '',
    address: '',
    email: '',
    phone: '',
    client_id: undefined,
    service_codes: [],
  });

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

    labsApi
      .getById(Number(id))
      .then((l: Lab) => {
        setForm({
          name: l.name,
          address: l.address ?? '',
          email: l.email ?? '',
          phone: l.phone ?? '',
          client_id: l.client_id,
          service_codes: l.service_codes,
        });
      })
      .catch(() => router.push('/admin/labs'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const set = <K extends keyof CreateLabDto>(k: K, v: CreateLabDto[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await labsApi.update(Number(id), form);
      router.push('/admin/labs');
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
        title="Update Lab"
        description="Update a lab"
        backHref="/admin/labs"
      />

      <Card className="max-w-2xl">
        <Card.Content>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
              <div>
                <Label>Allowed Services</Label>
                <p className="mt-1 text-xs text-muted">Leave empty to allow all services.</p>
                <ServiceCheckboxGroup
                  options={availableServices}
                  selected={form.service_codes ?? []}
                  onChange={(v) => set('service_codes', v)}
                />
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" variant="primary" isDisabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button type="button" variant="ghost" onPress={() => router.push('/admin/labs')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
