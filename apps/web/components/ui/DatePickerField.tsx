'use client';

import { Calendar, DateField, DatePicker, Label } from '@heroui/react';
import { parseDate, type CalendarDate, type DateValue } from '@internationalized/date';

function toDateValue(iso: string): CalendarDate | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

interface Props {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  'aria-label'?: string;
  className?: string;
}

/** Controlled YYYY-MM-DD string ↔ HeroUI DatePicker */
export function DatePickerField({
  value,
  onChange,
  label,
  'aria-label': ariaLabel,
  className,
}: Props) {
  const dateValue = toDateValue(value);

  return (
    <DatePicker
      className={className ?? 'w-full'}
      value={dateValue}
      onChange={(next: DateValue | null) => {
        onChange(next ? next.toString() : '');
      }}
      aria-label={ariaLabel ?? label ?? 'Date'}
    >
      {label ? <Label>{label}</Label> : null}
      <DateField.Group fullWidth>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label={ariaLabel ?? label ?? 'Choose date'}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
