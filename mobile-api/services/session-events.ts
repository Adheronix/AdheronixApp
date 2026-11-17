const listeners = new Set<() => void>();
export const onSessionExpired = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const expireSession = () => {
  for (const fn of listeners) fn();
};
