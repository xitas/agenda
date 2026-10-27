/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The API origin for builds (e.g. https://api.agenda.example). Unset in dev. */
  readonly VITE_API_URL?: string;
}
