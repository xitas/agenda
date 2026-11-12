// Runs before every test file. Native modules have no implementation under Jest, so each
// one the app touches is replaced: the libraries' own mocks where they ship one, and small
// in-memory fakes for the rest.
import 'react-native-gesture-handler/jestSetup';
import { notifyManager } from '@tanstack/react-query';
import { act } from 'react';

process.env.TZ = 'Pacific/Kiritimati';

// Reanimated 4 runs on react-native-worklets; both ship mocks for Jest.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

/** expo-secure-store: an in-memory Keystore. */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

/** expo-notifications: records what is scheduled. */
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn((request: { identifier: string }) =>
    Promise.resolve(request.identifier),
  ),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
}));

/** The Android date and time dialogs: tests answer them through this spy. */
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn() },
}));

beforeEach(() => {
  (require('expo-secure-store') as { __store: Map<string, string> }).__store.clear();
});

/**
 * The swipeable row's gesture runs on Reanimated shared values, which the Reanimated mock
 * doesn't fully implement. The swipe itself is the library's job; what we test is what
 * happens when it opens (onSwipeableOpen) and the Delete action it reveals, so it becomes
 * a plain View that renders both and passes onSwipeableOpen through for fireEvent.
 */
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    SwipeDirection: { LEFT: 'left', RIGHT: 'right' },
    default: ({
      children,
      renderRightActions,
      onSwipeableOpen,
    }: {
      children: unknown;
      renderRightActions?: () => unknown;
      onSwipeableOpen?: (direction: string) => void;
    }) =>
      React.createElement(
        View,
        { testID: 'swipeable', onSwipeableOpen },
        children,
        renderRightActions?.(),
      ),
  };
});

/**
 * TanStack Query hands query and mutation results to components from a timer (its notify
 * manager), so a result can land between a test's last step and the cleanup: on a slow,
 * loaded run React then warns that an update wasn't wrapped in act(...). Each hand-off is
 * real UI work, so it goes through act(...) like any other. Not while RNTL's waitFor polls:
 * it turns the act environment off then, and act would warn about that instead.
 */
notifyManager.setNotifyFunction((notify) => {
  if ((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT === true) {
    act(notify);
  } else {
    notify();
  }
});
