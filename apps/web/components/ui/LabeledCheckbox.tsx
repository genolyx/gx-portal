'use client';

import { Checkbox } from '@heroui/react';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Checkbox>, 'children'> & {
  children: React.ReactNode;
  contentClassName?: string;
};

/**
 * HeroUI v3 Checkbox: only Checkbox.Content is the clickable CheckboxButton.
 * Control must be nested inside Content, otherwise the box itself does not toggle.
 */
export function LabeledCheckbox({ children, contentClassName, ...props }: Props) {
  return (
    <Checkbox {...props}>
      <Checkbox.Content className={contentClassName}>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {children}
      </Checkbox.Content>
    </Checkbox>
  );
}
