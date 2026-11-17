import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { usePathname } from "expo-router";
import { useSession } from "./session";
import { scheduleService } from "../services/schedule.service";
import { routineState } from "../services/character-state";
import { onCareChanged } from "../services/care-events";
import type { Dose } from "../services/types";
type Progress = {
  doses: Dose[];
  routine: ReturnType<typeof routineState>;
  refresh: () => Promise<void>;
};
const EMPTY: Dose[] = [];
const Context = createContext<Progress>({
  doses: EMPTY,
  routine: routineState(EMPTY),
  refresh: async () => {},
});
export function CareProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useSession();
  const owner = user?.patient_id ?? null;
  const current = useRef(owner);
  current.current = owner;
  const [snapshot, setSnapshot] = useState<{
    owner: string | null;
    doses: Dose[];
  }>({ owner: null, doses: EMPTY });
  const last = useRef(0);
  const pending = useRef<{ owner: string; promise: Promise<void> } | null>(
    null,
  );
  const refresh = useCallback(async () => {
    if (!owner) return;
    if (pending.current?.owner === owner) return pending.current.promise;
    const promise = scheduleService
      .getUpcoming()
      .then((doses) => {
        if (current.current === owner) {
          last.current = Date.now();
          setSnapshot({ owner, doses });
        }
      })
      .finally(() => {
        if (pending.current?.promise === promise) pending.current = null;
      });
    pending.current = { owner, promise };
    return promise;
  }, [owner]);
  const path = usePathname();
  useEffect(() => {
    if (snapshot.owner !== owner || Date.now() - last.current > 30000)
      void refresh().catch(() => {});
  }, [path, owner, snapshot.owner, refresh]);
  useEffect(() => {
    const update = () => {
      if (AppState.currentState === "active") void refresh().catch(() => {});
    };
    const unsubscribe = onCareChanged(update);
    const active = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    const timer = setInterval(update, 60000);
    return () => {
      unsubscribe();
      active.remove();
      clearInterval(timer);
    };
  }, [refresh]);
  const doses = snapshot.owner === owner ? snapshot.doses : EMPTY;
  const value = useMemo(
    () => ({ doses, routine: routineState(doses), refresh }),
    [doses, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useCareProgress = () => useContext(Context);
