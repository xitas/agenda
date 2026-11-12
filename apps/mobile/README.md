# @agenda/mobile

Agenda for Android: an [Expo](https://expo.dev) (SDK 58) app with Expo Router. It reuses `packages/core` (the API client in token mode, the `EventRepository`, QuickAdd, the event form and its validation, dates, the reminder rule) and `packages/tokens`. The UI is native React Native components; nothing from `packages/ui` (which is React DOM).

- **Today:** QuickAdd with its live preview, today's events with the "now" marker, past events muted, and **New event**.
- **Calendar:** the month grid (dots for days with events) and the chosen day's list under it.
- **Search** across titles, places and notes.
- **Editor** as a bottom sheet: the web's form rules and messages (core's `eventFromForm`), Android's date and time dialogs.
- **Swipe left to delete,** with Undo in a snackbar for 5 seconds.
- **Settings:** theme, week start and clock (shared with every device), this phone's Server URL and reminders, devices, log out.
- **Reminders** as local notifications that fire with the app closed.

Only Android is built and tested. iOS would need a Mac (or EAS Build) and an Apple developer account.

## Set up Android (once)

Install [Android Studio](https://developer.android.com/studio), open it, then **More Actions → SDK Manager**:

- **SDK Platforms** (tick "Show Package Details"): Android 17.0 (API 37), which SDK 58 compiles against, and Android 16 (API 36) with **Google APIs Intel x86_64 Atom System Image** for the emulator.
- **SDK Tools** (tick "Show Package Details"): Android SDK Build-Tools **37.0.0**, NDK (Side by side) **27.1.12297006**, CMake, Android SDK Platform-Tools, Android Emulator.

Then **Virtual Device Manager → Create device**: a Pixel, with the API 36 Google APIs image.

Set these **user** environment variables (Windows: Start → "Edit environment variables for your account"), then restart VS Code and any terminal:

```
ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk
JAVA_HOME    = C:\Program Files\Android\Android Studio\jbr
Path        += %ANDROID_HOME%\platform-tools
Path        += %ANDROID_HOME%\emulator
```

Check: `adb --version`, `java -version` (17 or newer) and `emulator -list-avds` all answer.

## Run it (development build)

```sh
pnpm dev                                  # the API on :4001 and the web app
pnpm --filter @agenda/mobile android      # first time, and after any native change
pnpm --filter @agenda/mobile dev          # later: just Metro; open Agenda on the device
```

`android` (`expo run:android`) generates `android/` from `app.config.ts` (it isn't committed), builds a debug APK with Gradle, installs it on the running emulator or the phone plugged in over USB, and starts Metro. The first build takes several minutes; later ones are incremental. Edit any `.tsx` and the app reloads in place.

On the **emulator**, the default Server URL `http://10.0.2.2:4001` already works: `10.0.2.2` is the emulator's name for the PC's own `localhost`. Log in with the API password; the session shows as "Android phone" under Settings → Devices.

## On your phone

Turn on **Developer options** (Settings → About phone → tap Build number 7 times), then **USB debugging**, and plug the phone in. `adb devices` should list it (accept the prompt on the phone). Wireless debugging (Android 11+) works too: Developer options → Wireless debugging → Pair device with pairing code, then `adb pair <ip>:<port>` and `adb connect <ip>:<port>`.

The phone has to reach the API on your PC. Two ways:

**Over USB, nothing to open:** `adb reverse tcp:4001 tcp:4001` (and `tcp:8081` for Metro) makes the phone's `localhost:4001` the PC's. Set the Server URL to `http://localhost:4001`. It lasts until the cable comes out.

**Over Wi-Fi:**

1. **Let the API listen on the network.** It listens on `localhost` only, unless you say otherwise. In `apps/api/.env`, set `HOST=0.0.0.0` (every interface) and restart `pnpm dev`. Put it back when you're done.
2. **Find the PC's address:** `ipconfig` (the IPv4 Address under "Wireless LAN adapter Wi-Fi"), or in PowerShell `Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi`. Say it's `192.168.1.20`.
3. **Open the port on private networks only.** From an administrator PowerShell:

   ```powershell
   Get-NetConnectionProfile   # your Wi-Fi must say NetworkCategory: Private
   New-NetFirewallRule -DisplayName "Agenda API (dev)" -Direction Inbound -Protocol TCP -LocalPort 4001 -Action Allow -Profile Private
   ```

   If the network shows as Public, change it in Settings → Network & internet → Wi-Fi → (your network) → Private, rather than opening the port on public networks (café Wi-Fi). Remove the rule with `Remove-NetFirewallRule -DisplayName "Agenda API (dev)"`. A development build also loads its JavaScript from Metro on port 8081: add the same rule for 8081, or use `adb reverse tcp:8081 tcp:8081` over USB.

4. **Allow plain HTTP to that address in the build** (next section): `$env:AGENDA_DEV_HOSTS = "192.168.1.20"`, then `pnpm --filter @agenda/mobile exec expo prebuild --clean` and `pnpm --filter @agenda/mobile android`.
5. In the app, set the Server URL to `http://192.168.1.20:4001`. The login screen shows which server it will use, with **Change** next to it.

### Plain HTTP only to local addresses

Android 9+ refuses unencrypted HTTP unless the app says otherwise. The API on your PC has no certificate, so the app needs an exception, but only for addresses on your own network. Expo's usual switch (`usesCleartextTraffic`) would allow HTTP to every server on the internet.

`plugins/with-local-cleartext.js` writes a [network security config](https://developer.android.com/privacy-and-security/security-config) instead: HTTPS everywhere, plain HTTP only to `localhost`, `127.0.0.1`, `10.0.2.2` and the hosts in `AGENDA_DEV_HOSTS` (comma-separated). Android can only list exact hosts there (not "any 192.168.x.x"), so the address is fixed at build time: change it, and prebuild again. The app checks the same rule when you save a Server URL: `http://` is accepted only for local addresses (core's `normalizeServerUrl` with `httpsOutsideLocal`), and anything else must be `https://`.

## Builds: local and EAS

Both are set up and make the same app. **Local** builds (above, with Android Studio) are the default for day-to-day work: free, no queue, offline, and they show exactly what Gradle does. **EAS Build** makes the same APKs in the cloud, without Android Studio on the machine.

### Local

**A release APK to keep on the phone** (no Metro, JavaScript bundled inside):

```sh
pnpm --filter @agenda/mobile exec expo run:android --variant release
```

The APK lands in `android/app/build/outputs/apk/release/`. Expo's template signs release builds with the debug key, which is fine for your own phone and nothing else; a store build needs a real upload key (`android/app/build.gradle`'s `signingConfigs`, or EAS credentials). Install it on a connected phone with `adb install -r <apk>`.

### EAS Build

**What it is.** Expo's cloud build service. `eas build` uploads the repository (the files git tracks), and an Expo machine installs the workspace, runs the same `prebuild` and Gradle build, and signs the APK with a key EAS creates and keeps for you. You get a link and a QR code for the APK. The free plan queues builds and limits how many you run each month. It's also the way to build for iOS without a Mac.

**What you need:** a free account at [expo.dev](https://expo.dev). Nothing to install globally: the CLI runs through `pnpm dlx eas-cli`.

**Once:**

```sh
cd apps/mobile
pnpm dlx eas-cli login
pnpm dlx eas-cli init          # creates the project on expo.dev and prints its id
```

`app.config.ts` is code, so `eas init` can't edit it: add the id it prints as `extra: { eas: { projectId: '<id>' } }` in the config, and commit it (it isn't a secret).

**Profiles** (`eas.json`), both an installable APK with internal distribution (a link, not the Play Store):

| Profile       | What it builds                                                         | Command                                                   |
| ------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `development` | The development build (`expo-dev-client`): loads JavaScript from Metro | `pnpm dlx eas-cli build --profile development -p android` |
| `preview`     | A release build with the JavaScript inside, to keep on the phone       | `pnpm dlx eas-cli build --profile preview -p android`     |

How the monorepo builds there:

- `base` pins **Node 24.13.1** and turns on **Corepack**, so the build machine uses the pnpm version in the root `package.json`, exactly as CI does.
- EAS installs from the repository root, then runs this package's **`eas-build-post-install`** script, which builds `@agenda/tokens` and `@agenda/core`. The app imports their `dist/`, which isn't committed, so without this step Metro can't find them.
- `app.config.ts` and the cleartext plugin run **on the build machine**, so `AGENDA_DEV_HOSTS` in your terminal doesn't reach them. Each profile names an EAS environment (`development`, `preview`): set the variable there, e.g. `pnpm dlx eas-cli env:create --name AGENDA_DEV_HOSTS --value 192.168.1.20 --environment development --environment preview --visibility plaintext`. Without it, plain HTTP still works to `localhost` (with `adb reverse`) and the emulator.

**Local or EAS?** Local, day to day: you already have the SDK, and a rebuild is incremental. EAS when the PC without Android Studio has to build, for iOS later, and for a Play Store release (an AAB signed with an upload key EAS manages).

### In CI

The main job runs this package's lint, typecheck, Jest tests (with the 90% coverage gate) and `build`, which is `expo export --platform android`: it bundles the JavaScript with Metro exactly as a release build would, so a broken import or a module Metro can't resolve fails CI. CI doesn't build an APK: Gradle with the NDK takes 10 to 20 minutes and gigabytes of SDK on every run, for little more than this check catches.

## How it works

### React Native layout vs CSS

There is no DOM and no CSS: `<View>`, `<Text>`, `<ScrollView>` and `<Pressable>` become real Android views, and `style` is a JavaScript object (`StyleSheet.create`). The layout engine (Yoga) implements Flexbox with different defaults:

- every `View` is a flex container, and `flexDirection` defaults to **column**, not row;
- no cascade and no inheritance, except text styles from a `<Text>` to the `<Text>` inside it. A string must be inside `<Text>`;
- numbers are density-independent pixels (dp), no units: `padding: 16` is 16 dp on any screen. Tokens like `space[4]` are numbers here and `var(--ag-space-4)` on the web;
- no media queries or `:hover`; the theme comes from `useColorScheme()` and the user's setting, and colors from a palette object (`src/theme.ts`) built from `@agenda/tokens`;
- `position: 'absolute'` is relative to the parent, and there's no `fixed`: the snackbar is an absolute view at the root, `toastOffset.narrow` above the bottom plus the system navigation bar's safe-area inset, so it clears the tabs.

### Expo Go vs a development build

**Expo Go** is a ready-made app from the Play Store with a fixed set of native modules; it loads your JavaScript from Metro. Quick, but only for apps that need nothing else. Agenda can't use it: it declares `USE_EXACT_ALARM`, has its own network security config, and uses native libraries at versions Expo Go doesn't ship.

A **development build** is your own app (`expo-dev-client` included), built once with `expo run:android`, that also loads JavaScript from Metro. JavaScript changes reload at once; a native change (a new native library, a permission, `app.config.ts`, a plugin) needs `android` again.

### How Android schedules the reminders

`src/reminders.ts` turns the next 14 days of events into core's reminder schedule (the same rule as desktop and the extension: a key per event, offset and start) and hands each to `expo-notifications` as a date trigger. Underneath, that is an alarm in Android's **AlarmManager**, which belongs to the system, not the app: it fires with the app closed or swiped away. When it fires, Android starts a small receiver in the app that posts the notification; no JavaScript runs.

- **Exact vs inexact.** To save battery, Android batches inexact alarms and may deliver them minutes late, especially in Doze (screen off, phone still). Exact alarms (`setExactAndAllowWhileIdle`) fire on time, even in Doze. Since Android 12 they need a permission: `USE_EXACT_ALARM` is granted at install and meant for calendar and alarm apps (Google Play reviews it; this app isn't on Play). `expo-notifications` checks `canScheduleExactAlarms()` and uses the exact call when it can.
- **Reboots** wipe all alarms. `expo-notifications` keeps its scheduled notifications and re-arms them on `BOOT_COMPLETED` (and after an app update).
- **No duplicates.** Every reschedule cancels all, then schedules the current set, named by key. The app reschedules each time it opens, after every change made in it, and on every refresh. An event changed on another device reaches the phone the next time the app opens; refreshing in the background is Phase 7.
- **Permission (Android 13+).** Notifications need `POST_NOTIFICATIONS`, asked for once at the first login. Refuse it, and Settings shows "Reminders: off (blocked in Android settings)" with a button to the app's system settings. Reminders go to the "Reminders" channel (high importance: sound and heads-up), which you can tune in the system settings.
- **Battery savers** on some phones (Xiaomi, Samsung, OnePlus) kill apps harder than stock Android. If reminders don't arrive, set Agenda's battery use to "Unrestricted".

### Hermes

Release and development builds run on **Hermes**, React Native's JavaScript engine (not V8). Core needs three things from it: `Intl` with time zones (`@date-fns/tz` reads `longOffset`), `crypto.getRandomValues` (uuid v7 ids) and `URL`. `src/runtime-check.ts` tests them at startup in development builds and warns in the Metro log if one is missing, so no polyfill is added until one is needed.

### pnpm and Metro

pnpm installs each package once in `node_modules/.pnpm` and links it where it's used; Metro (React Native's bundler) used to need `node-linker=hoisted` or a custom `metro.config.js` for that. SDK 58 resolves through Expo Autolinking and follows the links itself, and `@agenda/core` and `@agenda/tokens` come from their built `dist/`, so there is no Metro config at all. `turbo` builds the packages before `build`, `lint`, `typecheck` and `test` here. When running `dev` on its own after changing `core`, rebuild it first (`pnpm --filter @agenda/core build`).

### Tests: Jest, not Vitest

The rest of the repo uses Vitest. React Native ships Flow-typed, untranspiled sources and native modules that only exist on a device, and `jest-expo` is the preset that knows how to transform the former and mock the latter. Vitest has no maintained React Native preset. `src/test-setup.ts` mocks each native module the app touches (secure store, notifications, the date picker, the bottom sheet, Reanimated). Screens are rendered inside the real providers with a fake repository and a fixed clock (`src/test-utils/render.tsx`), using React Native Testing Library: queries by role, label and text, as with Testing Library on the web. RNTL 14's `render`, `fireEvent` and `act` are async, so every call is awaited.

## Dependencies

| Package                                                                            | Why                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `expo`, `react`, `react-native`                                                    | The SDK and the framework, at the versions SDK 58 pins                                           |
| `expo-router`, `react-native-screens`, `react-native-safe-area-context`            | File-based routes in `app/` (tabs), native screen containers, insets for notches and system bars |
| `expo-linking`, `expo-constants`, `expo-status-bar`, `expo-system-ui`              | Needed by Expo Router; status bar and window background following the theme                      |
| `expo-dev-client`                                                                  | Makes `expo run:android` a development build that loads from Metro                               |
| `expo-secure-store`                                                                | The session token and Server URL, encrypted with a key in the Android Keystore                   |
| `expo-notifications`                                                               | Local reminder notifications, exact alarms, re-armed after reboot                                |
| `@gorhom/bottom-sheet`                                                             | The editor sheet (drag to resize or close, keyboard aware)                                       |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` | Swipe to delete, and what the bottom sheet runs on                                               |
| `@react-native-community/datetimepicker`                                           | Android's own date and time dialogs in the editor                                                |
| `@expo/vector-icons`                                                               | The tab icons (Ionicons), bundled with Expo: no extra native module                              |
| `@tanstack/react-query`, `date-fns`                                                | The same server-state and date libraries as the web app                                          |
| `jest`, `jest-expo`, `@testing-library/react-native`, `@types/jest`                | Tests (see above)                                                                                |
| `eslint-plugin-react-hooks`, `globals`                                             | The rules of hooks; Node and Jest globals for the CommonJS config plugin                         |

## Layout

```
app/                Expo Router routes: _layout.tsx (providers), (tabs)/ (the four tabs)
plugins/            the cleartext config plugin (and its test)
src/
  screens/          session.tsx (login, Server URL, "Can't reach"), tabs.tsx (the four screens)
  components/       ui (Button, Field, Choice, Chip, Section), EventRow, DayList, MonthGrid,
                    QuickAdd, EditorSheet, Snackbar
  api.ts            the core client in token mode, and its EventRepository
  data.ts           TanStack Query hooks: events by day, search, session, settings, mutations
  reminders.ts      rescheduling and the notification permission
  storage.ts        expo-secure-store: token and Server URL
  theme.ts          light and dark palettes from @agenda/tokens
```
