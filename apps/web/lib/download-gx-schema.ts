import { getGxOrderSchema } from '@gx-portal/types';

export function downloadGxOrderSchemaJson(serviceCode: string): void {
  const schema = getGxOrderSchema(serviceCode);
  if (!schema) return;
  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gx-order-schema-${schema.service_code}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
