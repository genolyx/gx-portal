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
import { clientsApi } from '../../../lib/api/admin';
import { systemApi } from '../../../lib/api/system';
import { LabeledCheckbox } from '../../ui/LabeledCheckbox';
import { PageHeader } from '../../ui/PageHeader';
import type { Client, CreateClientDto } from '@gx-portal/types';

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

export function ClientFormPage({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  const [form, setForm] = useState<CreateClientDto>({
    name: '',
    order_prefix: '',
    address: '',
    email: '',
    phone: '',
    language: '',
    type: 'Service',
    sequencing_data_method: 'Remote',
    is_managing_hospitals: false,
    auto_approve_orders: false,
    sign_report: false,
    service_codes: [],
  });

  useEffect(() => {
    systemApi
      .services()
      .then((svcs: unknown) => {
        if (Array.isArray(svcs)) {
          setAvailableServices((svcs as { code: string }[]).map((s) => s.code));
        }
      })
      .catch(() => {});

    clientsApi
      .getById(Number(id))
      .then((c: Client) => {
        setForm({
          name: c.name,
          order_prefix: c.order_prefix ?? '',
          address: c.address ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          language: c.language ?? '',
          type: c.type,
          sequencing_data_method: c.sequencing_data_method,
          is_managing_hospitals: c.is_managing_hospitals,
          auto_approve_orders: c.auto_approve_orders,
          sign_report: c.sign_report,
          service_codes: c.service_codes,
        });
      })
      .catch(() => router.push('/admin/clients'))
      .finally(() => setLoading(false));
  }, [id, router]);

  const set = <K extends keyof CreateClientDto>(key: K, value: CreateClientDto[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await clientsApi.update(Number(id), form);
      router.push('/admin/clients');
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
        title="Update Client"
        description="Update a client"
        backHref="/admin/clients"
      />

      <Card className="max-w-2xl">
        <Card.Content>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>
                  Client Name <span className="text-danger">*</span>
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
                  Order Prefix <span className="text-danger">*</span>
                </Label>
                <Input
                  value={form.order_prefix ?? ''}
                  onChange={(e) => set('order_prefix', e.target.value.toUpperCase())}
                  required
                  maxLength={2}
                  placeholder="GX"
                  className="max-w-[80px] uppercase"
                  fullWidth
                />
                <p className="text-xs text-muted">
                  Two letters used in order IDs (e.g. CS<strong>GX</strong>26070001).
                </p>
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
                <Label>Phone Number</Label>
                <Input
                  value={form.phone ?? ''}
                  onChange={(e) => set('phone', e.target.value)}
                  fullWidth
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <Input
                  value={form.language ?? ''}
                  onChange={(e) => set('language', e.target.value)}
                  placeholder="e.g. KO, EN"
                  fullWidth
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Type <span className="text-danger">*</span>
                </Label>
                <Select
                  selectedKey={form.type}
                  onSelectionChange={(key) => set('type', key as 'Managing' | 'Service')}
                  fullWidth
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="Service" textValue="Service">
                        Service
                      </ListBox.Item>
                      <ListBox.Item id="Managing" textValue="Managing">
                        Managing
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Sequencing Data Method <span className="text-danger">*</span>
                </Label>
                <Select
                  selectedKey={form.sequencing_data_method}
                  onSelectionChange={(key) =>
                    set('sequencing_data_method', key as 'Remote' | 'Local')
                  }
                  fullWidth
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="Remote" textValue="Remote">
                        Remote
                      </ListBox.Item>
                      <ListBox.Item id="Local" textValue="Local">
                        Local
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Switch
                isSelected={form.is_managing_hospitals ?? false}
                onChange={(v) => set('is_managing_hospitals', v)}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Is Managing Hospitals
                </Switch.Content>
              </Switch>
              <Switch
                isSelected={form.auto_approve_orders ?? false}
                onChange={(v) => set('auto_approve_orders', v)}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Auto Approve Orders
                </Switch.Content>
              </Switch>
              <Switch
                isSelected={form.sign_report ?? false}
                onChange={(v) => set('sign_report', v)}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Sign Report
                </Switch.Content>
              </Switch>
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
              <Button type="button" variant="ghost" onPress={() => router.push('/admin/clients')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
