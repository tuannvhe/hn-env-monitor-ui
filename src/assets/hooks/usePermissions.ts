import { authService } from '../services/auth.service';

export const usePermissions = () => {
  const user = authService.getCurrentUser();
  
  return {
    canCreate: user?.canCreate ?? false,
    canUpdate: user?.canUpdate ?? false,
    canDelete: user?.canDelete ?? false,
    role: user?.role
  };
};