'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { authTokens } from '@/shared/utils/authTokens';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface NotificationSocketState {
  isConnected: boolean;
  /** Non-null when the socket failed to connect or was rejected (e.g. bad token). */
  error: string | null;
}

/**
 * Real-time notification socket.
 *
 * Connects to the `/notifications` namespace authenticated with the user's
 * access token (socket.io `auth.token`). The server derives the private
 * `user:{id}` room from the verified JWT and only ever emits notifications to
 * that room — nothing here is broadcast and no userId is ever claimed by the
 * client beyond the gateway's own `subscribe` acknowledgement.
 */
export function useNotificationSocket(): NotificationSocketState {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = authTokens.getAccessToken();
    const user = authTokens.getUser();
    if (!token || !user?.id) return;

    let socket: Socket;
    try {
      socket = io(`${API_URL}/notifications`, {
        transports: ['websocket', 'polling'],
        auth: { token },
      });
    } catch (err) {
      // socket.io reports connection failures asynchronously via `connect_error`;
      // defer the defensive synchronous-construction failure so we don't set
      // state during the effect body.
      queueMicrotask(() =>
        setError(err instanceof Error ? err.message : 'Failed to connect to notification stream'),
      );
      return;
    }

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      socket.emit('subscribe', { userId: user.id });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      setError('Failed to connect to real-time notifications');
    });

    socket.on('subscribe-error', (data: { reason?: string }) => {
      setError(data?.reason === 'forbidden' ? 'Subscription denied' : 'Failed to subscribe to notifications');
    });

    socket.on('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    });

    // Real-time board updates. The server only emits these to project members
    // other than the actor, so invalidating the scoped queries is always safe
    // and keeps connected boards in sync.
    socket.on('board:updated', (payload: { projectId?: string }) => {
      if (payload?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['projects', payload.projectId, 'boards'] });
      }
    });

    socket.on('board:item-moved', (payload: { projectId?: string }) => {
      if (payload?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['projects', payload.projectId, 'work-items'] });
        queryClient.invalidateQueries({ queryKey: ['projects', payload.projectId, 'backlog'] });
        queryClient.invalidateQueries({ queryKey: ['projects', payload.projectId, 'iterations'] });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);

  return { isConnected, error };
}