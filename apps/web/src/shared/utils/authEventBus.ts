// Events that the apiClient fires and the AuthContext listens to
export type AuthEvent = 'session-expired' | 'token-refreshed';

type Listener = () => void;

const listeners: Map<AuthEvent, Set<Listener>> = new Map();

export const authEventBus = {
  on(event: AuthEvent, listener: Listener): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(listener);
    return () => {
      listeners.get(event)?.delete(listener);
    };
  },

  emit(event: AuthEvent): void {
    listeners.get(event)?.forEach((listener) => listener());
  },
};
