// Single canonical re-export — avoids the 3-hop chain:
// shared/hooks/useToast → shared/components/ui/Toast → components/feedback/Toast
export { useToast } from '@/components/feedback/Toast';
export type { ToastContextValue, ToastType, ToastItem } from '@/components/feedback/Toast';
