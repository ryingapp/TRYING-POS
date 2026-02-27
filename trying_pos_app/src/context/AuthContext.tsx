import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { database } from '../services/database';
import { syncService } from '../services/sync';
import type { User, Branch } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  branch: Branch | null;
  branches: Branch[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectBranch: (branch: Branch) => Promise<void>;
  refreshBranches: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  token: '@tryingpos_token',
  user: '@tryingpos_user',
  branch: '@tryingpos_branch',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    branch: null,
    branches: [],
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session on app start
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const [token, userJson, branchJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.token),
        AsyncStorage.getItem(STORAGE_KEYS.user),
        AsyncStorage.getItem(STORAGE_KEYS.branch),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson);
        const branch = branchJson ? JSON.parse(branchJson) : null;
        api.setToken(token);

        // Initialize database
        await database.init();

        // Notify sync service of saved branch
        if (branch?.id) {
          syncService.setBranchId(branch.id);
        }

        // Try to validate token
        try {
          const { user: freshUser } = await api.getMe();
          const branches = await api.getBranches();

          setState({
            user: freshUser,
            token,
            branch,
            branches,
            isLoading: false,
            isAuthenticated: true,
          });
        } catch {
          // Token might be expired but we're offline - use cached data
          setState({
            user,
            token,
            branch,
            branches: [],
            isLoading: false,
            isAuthenticated: true,
          });
        }
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    } catch (error) {
      console.log('Restore session error:', error);
      setState((s) => ({ ...s, isLoading: false }));
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await api.login(email, password);
    api.setToken(token);

    // Save to AsyncStorage
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.token, token),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user)),
    ]);

    // Initialize database
    await database.init();

    // Get branches
    let branches: Branch[] = [];
    try {
      branches = await api.getBranches();
    } catch {}

    // Auto-select first branch if only one
    let branch: Branch | null = null;
    if (branches.length === 1) {
      branch = branches[0];
      await AsyncStorage.setItem(STORAGE_KEYS.branch, JSON.stringify(branch));
    }

    setState({
      user,
      token,
      branch,
      branches,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(async () => {
    api.setToken(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.token),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
      AsyncStorage.removeItem(STORAGE_KEYS.branch),
    ]);
    await database.clearAll();

    setState({
      user: null,
      token: null,
      branch: null,
      branches: [],
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const selectBranch = useCallback(async (branch: Branch) => {
    await AsyncStorage.setItem(STORAGE_KEYS.branch, JSON.stringify(branch));
    syncService.setBranchId(branch.id);
    setState((s) => ({ ...s, branch }));
  }, []);

  const refreshBranches = useCallback(async () => {
    try {
      const branches = await api.getBranches();
      setState((s) => ({ ...s, branches }));
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        selectBranch,
        refreshBranches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
