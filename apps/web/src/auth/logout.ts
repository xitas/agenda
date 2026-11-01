import { useToast } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApi } from '../app/api';
import { usePlatform } from '../app/platform';

/** Logs this device out: everything cached belonged to the session, so it is cleared. */
export function useLogout() {
  const api = useApi();
  const { auth } = usePlatform();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      await api.auth.logout();
      // The server has revoked the token; the copy in the keychain goes too.
      if (auth.kind === 'token') await auth.tokens.clear();
    },
    onSuccess: () => {
      queryClient.clear();
      void navigate('/login', { replace: true });
    },
    onError: () => {
      toast({ message: "Couldn't log out. Check your connection and try again." });
    },
  });
}
