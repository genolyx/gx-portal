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
import { clientsApi } from '../../../lib/api/admin';
import { systemApi } from '../../../lib/api/system';
import { LabeledCheckbox } from '../../ui/LabeledCheckbox';
import type { CreateClientDto } from '@gx-portal/types';

const EMPTY_FORM: CreateClientDto = {
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
};

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreateClientModal({ onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [form, setForm] = useState<CreateClientDto>(EMPTY_FORM);

  useEffect(() => {
    systemApi
      .services()
      .then((svcs: unknown) => {
        if (Array.isArray(svcs)) {
          setAvailableServices((svcs as { code: string }[]).map((s) => s.code));
        }
      })
      .catch(() => {});
  }, []);

  const set = <K extends keyof CreateClientDto>(key: K, value: CreateClientDto[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
      await clientsApi.create(form);
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
              <Modal.Heading>Create Client</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <form onSubmit={handleSubmit}>
              <Modal.Body>
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
                      autoFocus
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
                      aria-label="Type"
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
                      aria-label="Sequencing Data Method"
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

                <div className="mt-5 flex flex-col gap-4">
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
                  {saving ? 'Creating…' : 'Create Client'}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
