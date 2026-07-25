'use client';

import { useState } from 'react';
import { Button, Spinner, toast } from '@heroui/react';
import { RefreshCw } from 'lucide-react';

type ButtonVariant = React.ComponentProps<typeof Button>['variant'];
type ButtonSize = React.ComponentProps<typeof Button>['size'];

interface Props {
  /** Sync or async handler — spinner runs until the Promise settles. */
  onPress: () => void | Promise<void>;
  /** Optional controlled loading; when omitted, loading is tracked from onPress. */
  isLoading?: boolean;
  isDisabled?: boolean;
  label?: string;
  loadingLabel?: string;
  /** Toast on success (default: "Refreshed"). Set false to disable. */
  successToast?: string | false;
  /** Toast on failure (default: error message). Set false to disable. */
  errorToast?: string | false;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Refresh control: RefreshCw when idle, Spinner while loading, toast when done. */
export function RefreshButton({
  onPress,
  isLoading: controlledLoading,
  isDisabled = false,
  label = 'Refresh',
  loadingLabel = 'Refreshing…',
  successToast = 'Refreshed',
  errorToast,
  variant = 'secondary',
  size = 'sm',
  className,
}: Props) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isLoading = controlledLoading ?? internalLoading;

  const handlePress = () => {
    void (async () => {
      if (controlledLoading === undefined) setInternalLoading(true);
      try {
        await Promise.resolve(onPress());
        if (successToast !== false) {
          toast.success(successToast);
        }
      } catch (e) {
        if (errorToast !== false) {
          toast.danger(
            errorToast
              ?? (e instanceof Error ? e.message : 'Refresh failed'),
          );
        }
      } finally {
        if (controlledLoading === undefined) setInternalLoading(false);
      }
    })();
  };

  return (
    <Button
      size={size}
      variant={variant}
      isDisabled={isDisabled || isLoading}
      onPress={handlePress}
      className={className}
    >
      {isLoading ? (
        <Spinner size="md" color="current" />
      ) : (
        <RefreshCw size={16} strokeWidth={2} aria-hidden className="shrink-0" />
      )}
      <span>{isLoading ? loadingLabel : label}</span>
    </Button>
  );
}
