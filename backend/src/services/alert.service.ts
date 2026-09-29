import { supabaseAdmin } from "../config/supabase";
import { JwtPayload, AlertLevel } from "../types";

export const alertService = {
  async createAlert(payload: {
    babyId: string;
    type: string;
    message: string;
    severity: "warning" | "critical";
  }) {
    const { data, error } = await supabaseAdmin
      .from("alert_logs")
      .insert({
        baby_id: payload.babyId,
        type: payload.type,
        message: payload.message,
        severity: payload.severity,
        acknowledged: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[Alert] Gagal menyimpan alert:", error.message);
      return null;
    }

    return data;
  },

  async getAlertsByBaby(babyId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from("alert_logs")
      .select("*")
      .eq("baby_id", babyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data;
  },

  async acknowledgeAlert(alertId: string, user: JwtPayload) {
    const { data: alert, error: alertError } = await supabaseAdmin
      .from("alert_logs")
      .select("id, baby_id, acknowledged")
      .eq("id", alertId)
      .maybeSingle();

    if (alertError) {
      throw new Error(alertError.message);
    }

    if (!alert) {
      throw new Error("Alert tidak ditemukan");
    }

    // Parent hanya boleh acknowledge alert milik bayinya sendiri.
    if (user.role === "parent") {
      if (!user.babyId || user.babyId !== alert.baby_id) {
        throw new Error("Akses alert ditolak");
      }
    }

    // Nurse/caregiver hanya boleh acknowledge alert
    // dari baby yang berada pada unit miliknya.
    if (user.role === "nurse") {
      if (!user.unitId) {
        throw new Error("Unit pengasuh tidak ditemukan");
      }

      const { data: baby, error: babyError } = await supabaseAdmin
        .from("babies")
        .select("id, unit_id")
        .eq("id", alert.baby_id)
        .maybeSingle();

      if (babyError) {
        throw new Error(babyError.message);
      }

      if (!baby) {
        throw new Error("Bayi terkait alert tidak ditemukan");
      }

      if (baby.unit_id !== user.unitId) {
        throw new Error("Akses alert ditolak");
      }
    }

    if (alert.acknowledged) {
      return {
        id: alert.id,
        acknowledged: true,
      };
    }

    const { data, error: updateError } = await supabaseAdmin
      .from("alert_logs")
      .update({
        acknowledged: true,
      })
      .eq("id", alertId)
      .select("id, baby_id, acknowledged")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return data;
  },

  determineAlertLevel(
    temperature: number,
    tempMin: number,
    tempMax: number,
  ): AlertLevel {
    if (temperature > tempMax || temperature < tempMin) return "warning";
    return "normal";
  },
};
