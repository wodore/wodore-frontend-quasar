// /composables/useServices.ts
import AuthService from '@services/auth';

export const useAuthService = () => {
  return new AuthService();
};
