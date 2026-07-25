'use client';

import { Header, Label, ListBox, Select } from '@heroui/react';

export type SelectOption = { id: string; label: string };
export type SelectOptionGroup = { id: string; label: string; options: SelectOption[] };

const EMPTY_KEY = '__empty__';

function toKey(id: string): string {
  return id === '' ? EMPTY_KEY : id;
}

function fromKey(key: string): string {
  return key === EMPTY_KEY ? '' : key;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  groups?: SelectOptionGroup[];
  label?: string;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  fullWidth?: boolean;
}

/** Controlled string value ↔ HeroUI Select + ListBox */
export function SelectField({
  value,
  onChange,
  options = [],
  groups,
  label,
  placeholder,
  'aria-label': ariaLabel,
  className,
  fullWidth = true,
}: Props) {
  const flat = groups ? groups.flatMap((g) => g.options) : options;
  const selectedKey =
    value === '' && placeholder && !flat.some((o) => o.id === '')
      ? null
      : toKey(value);

  return (
    <Select
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key == null) {
          onChange('');
          return;
        }
        onChange(fromKey(String(key)));
      }}
      placeholder={placeholder}
      aria-label={ariaLabel ?? label ?? placeholder ?? 'Select'}
      className={className}
      fullWidth={fullWidth}
    >
      {label ? <Label>{label}</Label> : null}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {groups
            ? groups.map((group) => (
                <ListBox.Section key={group.id}>
                  <Header>{group.label}</Header>
                  {group.options.map((opt) => (
                    <ListBox.Item key={toKey(opt.id)} id={toKey(opt.id)} textValue={opt.label}>
                      {opt.label}
                    </ListBox.Item>
                  ))}
                </ListBox.Section>
              ))
            : options.map((opt) => (
                <ListBox.Item key={toKey(opt.id)} id={toKey(opt.id)} textValue={opt.label}>
                  {opt.label}
                </ListBox.Item>
              ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
