import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseGvcPanels,
  removeGvcPanel,
  upsertGvcPanel,
} from './gvc-panels';

describe('GVC panel catalog', () => {
  it('starts with the panels already shared with GVC', () => {
    const panels = parseGvcPanels(null);
    assert.deepEqual(panels.map((panel) => panel.code), ['carrier-2000', 'hereditary-cancer-71']);
  });

  it('keeps an explicit empty list empty', () => {
    assert.deepEqual(parseGvcPanels('[]'), []);
  });

  it('saves a new name and code, and edits the name without changing the code', () => {
    const created = upsertGvcPanel(parseGvcPanels('[]'), {
      code: 'Carrier-500',
      name: 'Carrier 500',
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.deepEqual(created.panels, [{ code: 'Carrier-500', name: 'Carrier 500' }]);

    const renamed = upsertGvcPanel(created.panels, {
      code: 'Carrier-500',
      name: 'Expanded carrier 500',
      previousCode: 'Carrier-500',
    });
    assert.equal(renamed.ok, true);
    if (!renamed.ok) return;
    assert.equal(renamed.panels[0]?.name, 'Expanded carrier 500');
    assert.equal(renamed.panels[0]?.code, 'Carrier-500');
  });

  it('requires a pasted code', () => {
    const result = upsertGvcPanel([], { code: '   ', name: 'Carrier 500' });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.message, 'Code is required.');
  });

  it('rejects a second panel with the same code', () => {
    const result = upsertGvcPanel(
      [
        { code: 'carrier-2000', name: 'Carrier 2000+' },
        { code: 'other', name: 'Other' },
      ],
      { code: 'carrier-2000', name: 'Renamed other', previousCode: 'other' },
    );
    assert.equal(result.ok, false);
  });

  it('can correct a code and drop a panel', () => {
    const updated = upsertGvcPanel(
      [{ code: 'carrier-200', name: 'Carrier 2000+' }],
      { code: 'carrier-2000', name: 'Carrier 2000+', previousCode: 'carrier-200' },
    );
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.deepEqual(removeGvcPanel(updated.panels, 'carrier-2000'), []);
  });
});
