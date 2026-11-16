import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authService } from "../services/auth.service";
import { Patient } from "../services/types";
import { notificationService } from "../services/notification.service";
import { onSessionExpired } from "../services/session-events";

interface Session {
  user: Patient | null;
  loading: boolean;
  unread: number;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Patient | null>(null),
    [loading, setLoading] = useState(true),
    [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(async () => {
    try {
      setUnread(await notificationService.getUnreadCount());
    } catch {
      setUnread(0);
    }
  }, []);
  const refresh = useCallback(async () => {
    try {
      if (!(await authService.isAuthenticated())) {
        setUser(null);
        return;
      }
      setUser(await authService.getProfile());
      await refreshUnread();
    } catch {
      setUser(await authService.getUser());
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);
  useEffect(() => {
    void refresh();
    return onSessionExpired(() => {
      setUser(null);
      setUnread(0);
    });
  }, [refresh]);
  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setUnread(0);
  }, []);
  return (
    <Context.Provider
      value={{ user, loading, unread, refresh, refreshUnread, logout }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Session provider missing");
  return value;
}
