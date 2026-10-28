/** Fixed settings for an e2e run: its own ports, so a dev API on 4001 is left alone. */
export const API_PORT = 4101;
export const WEB_PORT = 5101;
export const WEB_ORIGIN = `http://localhost:${String(WEB_PORT)}`;

/** The password the run's API is started with. Not a secret: the API only lives for the run. */
export const PASSWORD = 'e2e password for a throwaway API';
