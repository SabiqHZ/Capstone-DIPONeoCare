import { supabaseAdmin } from '../config/supabase';

export const reportService = {
  async getDailyReport(babyId: string, date: string) {
    // Cek apakah laporan sudah ada
    const { data: existing } = await supabaseAdmin
      .from('daily_reports')
      .select('*')
      .eq('baby_id', babyId)
      .eq('date', date)
      .single();

    if (existing) {
      return mapReport(existing);
    }

    // Kalau belum ada, generate dari alert_logs dan baby_statuses
    const generated = await generateDailyReport(babyId, date);
    return generated;
  },

  async getReportList(babyId: string, limit = 7) {
    const { data, error } = await supabaseAdmin
      .from('daily_reports')
      .select('date, total_prone_events, avg_temperature, total_crying_events')
      .eq('baby_id', babyId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

// ── Helper: generate laporan dari data mentah ─────────────────────────

async function generateDailyReport(babyId: string, date: string) {
  // Ambil alert logs untuk hari ini
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  const { data: alerts } = await supabaseAdmin
    .from('alert_logs')
    .select('type, severity, created_at')
    .eq('baby_id', babyId)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay);

  const proneEvents = alerts?.filter((a) => a.type === 'PRONE_POSITION').length ?? 0;
  const cryingEvents = alerts?.filter((a) => a.type === 'CRYING_DETECTED').length ?? 0;

  // Ambil status terbaru sebagai referensi suhu
  const { data: status } = await supabaseAdmin
    .from('baby_statuses')
    .select('temperature')
    .eq('baby_id', babyId)
    .single();

  const avgTemp = status?.temperature ?? 0;

  // Build hourly positions dari alert logs (simulasi)
  const hourlyPositions = buildHourlyPositions(alerts ?? []);

  return {
    babyId,
    date,
    totalProneEvents: proneEvents,
    avgTemperature: avgTemp,
    maxTemperature: avgTemp + 0.3,
    minTemperature: avgTemp - 0.3,
    totalCryingEvents: cryingEvents,
    hourlyPositions,
    temperatureTimeline: [],
  };
}

function buildHourlyPositions(alerts: any[]) {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    supine: 50,
    prone: 0,
    lateral: 0,
  }));

  alerts
    .filter((a) => a.type === 'PRONE_POSITION')
    .forEach((a) => {
      const hour = new Date(a.created_at).getHours();
      if (hours[hour]) {
        hours[hour].prone += 10;
        hours[hour].supine = Math.max(0, hours[hour].supine - 10);
      }
    });

  return hours;
}

function mapReport(data: any) {
  return {
    babyId: data.baby_id,
    date: data.date,
    totalProneEvents: data.total_prone_events,
    avgTemperature: parseFloat(data.avg_temperature),
    maxTemperature: parseFloat(data.max_temperature),
    minTemperature: parseFloat(data.min_temperature),
    totalCryingEvents: data.total_crying_events,
    hourlyPositions: data.hourly_positions ?? [],
    temperatureTimeline: data.temperature_timeline ?? [],
  };
}