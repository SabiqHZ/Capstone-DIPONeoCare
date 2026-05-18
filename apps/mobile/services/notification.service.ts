import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import  api  from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,       
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const EXPO_PROJECT_ID = 'f8b3dee9-6cc9-49a6-8a28-737be8b5f569';

export const notificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('[Notif] Hanya berjalan di device fisik');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notif] Permission ditolak');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      EXPO_PROJECT_ID;

    if (!projectId) {
      console.error('[Notif] Project ID tidak ditemukan');
      return null;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      console.log('[Notif] Push token:', token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('smart-vision-alerts', {
          name: 'Smart Vision Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E24B4A',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('smart-vision-info', {
          name: 'Smart Vision Info',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      return token;
    } catch (err: any) {
      console.error('[Notif] Gagal ambil token:', err.message);
      return null;
    }
  },

  async saveTokenToBackend(token: string): Promise<void> {
    try {
      await api.post('/notifications/token', {
        token,
        platform: Platform.OS,
      });
      console.log('[Notif] Token tersimpan ke backend');
    } catch (err) {
      console.error('[Notif] Gagal simpan token:', err);
    }
  },

  async showLocalNotification(payload: {
    title: string;
    body: string;
    severity: 'warning' | 'critical';
    babyId: string;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          sound: 'default',
          data: { babyId: payload.babyId, severity: payload.severity },
          color: payload.severity === 'critical' ? '#E24B4A' : '#EF9F27',
        },
        trigger: null,
      });
    } catch (err: any) {
      console.error('[Notif] Gagal tampilkan notifikasi lokal:', err.message);
    }
  },

  async clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
  },
};