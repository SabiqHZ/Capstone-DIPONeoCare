import { supabaseAdmin } from "../config/supabase";

export const pushNotificationService = {
  async sendAlert(babyId: string, title: string, body: string, severity: string) {
    const { data: baby, error: babyError } = await supabaseAdmin
      .from("babies")
      .select("unit_id")
      .eq("id", babyId)
      .maybeSingle();
    if (babyError) throw new Error(babyError.message);

    const { data: parentTokens, error: parentError } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("baby_id", babyId);
    if (parentError) throw new Error(parentError.message);

    let caregiverIds: string[] = [];
    if (baby?.unit_id) {
      const { data: caregivers, error } = await supabaseAdmin
        .from("nurses")
        .select("id")
        .eq("unit_id", baby.unit_id);
      if (error) throw new Error(error.message);
      caregiverIds = (caregivers ?? []).map((item) => item.id);
    }

    let caregiverTokens: { token: string }[] = [];
    if (caregiverIds.length) {
      const { data, error } = await supabaseAdmin
        .from("push_tokens")
        .select("token")
        .in("user_id", caregiverIds);
      if (error) throw new Error(error.message);
      caregiverTokens = data ?? [];
    }

    const tokens = [...(parentTokens ?? []), ...caregiverTokens]
      .map((item) => item.token)
      .filter((token, index, all) => (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) && all.indexOf(token) === index);
    if (!tokens.length) return;

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokens.map((to) => ({
        to,
        title,
        body,
        sound: "default",
        priority: severity === "critical" ? "high" : "default",
        data: { babyId, severity },
      }))),
    });
    if (!response.ok) throw new Error(`Expo push returned ${response.status}`);
  },
};
