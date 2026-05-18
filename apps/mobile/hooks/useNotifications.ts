import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { notificationService } from '../services/notification.service';
import { useAuthStore } from '../stores/auth.store';

export function useNotifications() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!user) return;

    // Register dan simpan token
    notificationService.registerForPushNotifications().then((token) => {
      if (token) {
        notificationService.saveTokenToBackend(token);
      }
    });

    // Listener: notifikasi masuk saat app di foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('[Notif] Received:', notification.request.content.title);
      });

    // Listener: user tap notifikasi → navigasi ke halaman yang relevan
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as {
          babyId?: string;
          severity?: string;
        };

        console.log('[Notif] Tapped, babyId:', data.babyId);

        if (data.babyId) {
          if (user.role === 'caregiver') {
            router.push(`/(caregiver)/baby/${data.babyId}`);
          } else {
            router.push('/(parent)/dashboard');
          }
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.token]);

  return null;
}