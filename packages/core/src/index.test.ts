import { describe, expect, it } from 'vitest';
import * as core from './index.js';

describe('public API', () => {
  it('exports exactly the supported runtime values', () => {
    // Adding or removing an export should be a deliberate change to this list.
    expect(Object.keys(core).sort()).toEqual([
      'API_ERROR_CODES',
      'API_PREFIX',
      'APP_NAME',
      'AgendaEventSchema',
      'ApiError',
      'ApiErrorBodySchema',
      'DEFAULT_EVENT_COLOR',
      'DEFAULT_TIMEOUT_MS',
      'EVENT_COLORS',
      'EventColorSchema',
      'EventCreateSchema',
      'EventListSchema',
      'EventPageSchema',
      'EventPatchSchema',
      'ImportFormatError',
      'ImportReportSchema',
      'LoginRequestSchema',
      'LoginTokenResponseSchema',
      'NetworkError',
      'PlainDateSchema',
      'QUICK_ADD_WARNINGS',
      'SessionListSchema',
      'SessionResponseSchema',
      'SessionSchema',
      'TimeZoneSchema',
      'UtcInstantSchema',
      'V0EventSchema',
      'V0_ID_NAMESPACE',
      'addDaysToPlainDate',
      'addMonthsToPlainDate',
      'checkEventTiming',
      'createApiClient',
      'dayAgenda',
      'dayRangeInTz',
      'eventDays',
      'eventOverlapsRange',
      'formatEventTime',
      'fromV0',
      'monthGrid',
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
