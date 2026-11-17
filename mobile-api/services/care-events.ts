const listeners = new Set<() => void>();
export function onCareChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function careChanged() {
  listeners.forEach((listener) => listener());
}
