import { useToast } from '@agenda/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApi } from '../app/api';

/** Logs this device out: everything cached belonged to the session, so it is cleared. */
export function useLogout() {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.clear();
      void navigate('/login', { replace: true });
    },
    onError: () => {
      toast({ message: "Couldn't log out. Check your connection and try again." });
    },
  });
}
