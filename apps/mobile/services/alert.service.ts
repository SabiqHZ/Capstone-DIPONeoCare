import { api } from "./api";
import { AlertNotification, NotificationType } from "../types";

interface AlertApiResponse {
  id: string;
  baby_id: string;
  type: string;
  message: string;
  severity: "warning" | "critical";
  created_at: string;
  acknowledged: boolean;
}

function normalizeAlert(alert: AlertApiResponse): AlertNotification {
  return {
    id: alert.id,
    babyId: alert.baby_id,

    // Nama bayi tidak diperlukan oleh AlertBanner.
    // Bisa di-enrich kemudian jika dibutuhkan.
    babyName: "",

    type: alert.type as NotificationType,
    message: alert.message,
    severity: alert.severity,
    timestamp: alert.created_at,
    acknowledged: Boolean(alert.acknowledged),
  };
}

export const alertService = {
  async getAlerts(limit = 50): Promise<AlertNotification[]> {
    const response = await api.get("/alerts", {
      params: { limit },
    });

    const data = response.data?.data ?? [];

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(normalizeAlert);
  },
};
