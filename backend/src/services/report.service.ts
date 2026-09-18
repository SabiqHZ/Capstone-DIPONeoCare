import { supabaseAdmin } from '../config/supabase';

interface ActivitySample {
  sleeping: boolean;
  awake: boolean;
  crying: boolean;
  recorded_at: string;
}

interface HourlyActivity {
  hour: number;
  sleepSeconds: number;
  awakeSeconds: number;
  cryingSeconds: number;
}

export const reportService = {
  // Laporan selalu dihitung dari sampel AI mentah agar data terbaru langsung terlihat.
  async getDailyReport(babyId: string, date: string) {
    return buildDailyReport(babyId, date);
  },

  async getReportList(babyId: string, limit = 7) {
    const { data, error } = await supabaseAdmin
      .from('daily_reports')
      .select('date, total_sleep_minutes, total_awake_minutes, total_crying_events')
      .eq('baby_id', babyId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data ?? [];
  },
};

async function buildDailyReport(babyId: string, date: string) {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(startOfDay.getTime())) throw new Error('Format tanggal tidak valid');

  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const { data, error } = await supabaseAdmin
    .from('baby_activity_samples')
    .select('sleeping, awake, crying, recorded_at')
    .eq('baby_id', babyId)
    .gte('recorded_at', startOfDay.toISOString())
    .lt('recorded_at', endOfDay.toISOString())
    .order('recorded_at', { ascending: true });

  if (error) throw new Error(error.message);

  const hourlyActivities: HourlyActivity[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    sleepSeconds: 0,
    awakeSeconds: 0,
    cryingSeconds: 0,
  }));

  let cryingEvents = 0;
  let previousCryingAt: number | null = null;

  for (const sample of (data ?? []) as ActivitySample[]) {
    const recordedAt = new Date(sample.recorded_at);
    const hour = recordedAt.getUTCHours();
    const hourly = hourlyActivities[hour];

    if (sample.sleeping) hourly.sleepSeconds += 1;
    if (sample.awake) hourly.awakeSeconds += 1;
    if (sample.crying) {
      hourly.cryingSeconds += 1;

      // Tangisan baru dihitung ketika status sebelumnya bukan menangis
      // atau terdapat jeda lebih dari satu detik antar sampel.
      if (previousCryingAt === null || recordedAt.getTime() - previousCryingAt > 1_500) {
        cryingEvents += 1;
      }
      previousCryingAt = recordedAt.getTime();
    } else {
      previousCryingAt = null;
    }
  }

  const totals = hourlyActivities.reduce(
    (sum, hour) => ({
      sleepSeconds: sum.sleepSeconds + hour.sleepSeconds,
      awakeSeconds: sum.awakeSeconds + hour.awakeSeconds,
      cryingSeconds: sum.cryingSeconds + hour.cryingSeconds,
    }),
    { sleepSeconds: 0, awakeSeconds: 0, cryingSeconds: 0 }
  );

  return {
    babyId,
    date,
    totalSleepSeconds: totals.sleepSeconds,
    totalAwakeSeconds: totals.awakeSeconds,
    totalCryingSeconds: totals.cryingSeconds,
    totalSleepMinutes: secondsToMinutes(totals.sleepSeconds),
    totalAwakeMinutes: secondsToMinutes(totals.awakeSeconds),
    totalCryingMinutes: secondsToMinutes(totals.cryingSeconds),
    totalCryingEvents: cryingEvents,
    hourlyActivities: hourlyActivities.map((hour) => ({
      ...hour,
      sleepMinutes: secondsToMinutes(hour.sleepSeconds),
      awakeMinutes: secondsToMinutes(hour.awakeSeconds),
      cryingMinutes: secondsToMinutes(hour.cryingSeconds),
    })),
  };
}

function secondsToMinutes(seconds: number): number {
  return Number((seconds / 60).toFixed(2));
}
