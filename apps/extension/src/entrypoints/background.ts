import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { onAlarm, onMenuClick, refresh, setUp } from '../background/worker';
import { browserEnv } from '../env';

// The service worker. Chrome starts it for an event and stops it when idle, so the
// listeners are registered synchronously, on every start: a listener added later (after
// an await) would miss the event that woke the worker. The work itself is in
// background/worker.ts and keeps no state in memory.
export default defineBackground(() => {
  const env = browserEnv();
  browser.runtime.onInstalled.addListener(() => {
    void setUp(env);
  });
  browser.runtime.onStartup.addListener(() => {
    void setUp(env);
  });
  browser.alarms.onAlarm.addListener((alarm) => {
    void onAlarm(alarm.name, env);
  });
  // Only the extension's own pages can message it (no externally_connectable), and every
  // message means the same: events or settings changed, so fetch again.
  browser.runtime.onMessage.addListener(() => {
    void refresh(env);
  });
  browser.contextMenus.onClicked.addListener((info) => {
    void onMenuClick(info);
  });
  // Logging in or out in the popup changes the token: refresh the badge and reminders.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'token' in changes) void refresh(env);
  });
});
