import { describe, expect, it } from 'vitest';
import * as core from './index.js';

describe('public API', () => {
  it('exports exactly the supported runtime values', () => {
    // Adding or removing an export should be a deliberate change to this list.
    expect(Object.keys(core).sort()).toEqual([
      'APP_NAME',
      'AgendaEventSchema',
      'DEFAULT_EVENT_COLOR',
      'EVENT_COLORS',
      'EventColorSchema',
      'EventCreateSchema',
      'EventPatchSchema',
      'ImportFormatError',
      'PlainDateSchema',
      'QUICK_ADD_WARNINGS',
      'TimeZoneSchema',
      'UtcInstantSchema',
      'V0EventSchema',
      'V0_ID_NAMESPACE',
      'checkEventTiming',
      'formatEventTime',
      'fromV0',
      'newId',
      'parseImport',
      'parseQuickAdd',
      'plainDateInTz',
      'rangeForView',
      'startOfDayInTz',
      'toICalendar',
    ]);
    expect(core.APP_NAME).toBe('Agenda');
  });
});
