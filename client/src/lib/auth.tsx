import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { apiRequest, queryClient } from "./queryClient";


interface AuthUser {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  isActive?: boolean | null;
  permDashboard?: boolean | null;
  permPos?: boolean | null;
  permOrders?: boolean | null;
  permMenu?: boolean | null;
  permKitchen?: boolean | null;
  permInventory?: boolean | null;
  permReviews?: boolean | null;
  permMarketing?: boolean | null;
  permQr?: boolean | null;
  permReports?: boolean | null;
  permSettings?: boolean | null;
  permTables?: boolean | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  restaurantName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("auth_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      localStorage.setItem("auth_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("auth_user");
    }
  }, [user]);

  useEffect(() => {
    const validateSession = async () => {
      const token = localStorage.getItem("auth_token");
      const saved = localStorage.getItem("auth_user");
      if (!token || !saved) {
        setUser(null);
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_token");
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { "Authorization": `Bearer ${token}` },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
          localStorage.removeItem("auth_user");
          localStorage.removeItem("auth_token");
        }
      } catch {
        setUser(null);
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_token");
      }
      setIsLoading(false);
    };
    validateSession();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      queryClient.clear();
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);
    try {
      // Clear old session data before registering
      localStorage.removeItem("auth_user");
      localStorage.removeItem("auth_token");
      localStorage.removeItem("last_branch_id");
      queryClient.clear();
      const res = await apiRequest("POST", "/api/users/register", data);
      const result = await res.json();
      localStorage.setItem("auth_token", result.token);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("last_branch_id");
    queryClient.clear();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl">T</div>
          <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
