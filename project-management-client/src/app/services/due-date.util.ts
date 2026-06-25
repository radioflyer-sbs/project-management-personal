export type DueCountdownMode = 'time' | 'days';

export interface DueCountdown {
    /** 'time' → "HH:MM" remaining; 'days' → "Nd". */
    mode: DueCountdownMode;
    text: string;
}

const startOfDayMs = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Builds the countdown shown on a task card for a due date relative to `now`.
 *
 * Rules:
 * - Due on a future calendar date → day count ("Nd").
 * - Due on today's calendar date → time remaining ("HH:MM").
 * - Overnight exception: if the due time is before 05:00 AND today is exactly the
 *   calendar day before the due date, show "HH:MM" instead of a day count — early-hours
 *   items read as imminent rather than "a day away".
 * - Overdue (now ≥ due) → bottoms out at "00:00".
 */
export function formatDueCountdown(due: Date, now: Date): DueCountdown {
    const ms = due.getTime() - now.getTime();
    if (ms <= 0) { return { mode: 'time', text: '00:00' }; }

    const dayDiff = Math.round((startOfDayMs(due) - startOfDayMs(now)) / 86_400_000);
    const imminentOvernight = dayDiff === 1 && due.getHours() < 5;

    if (dayDiff <= 0 || imminentOvernight) {
        const totalMinutes = Math.floor(ms / 60_000);
        const hh = Math.floor(totalMinutes / 60);
        const mm = totalMinutes % 60;
        const pad = (n: number) => String(n).padStart(2, '0');
        return { mode: 'time', text: `${pad(hh)}:${pad(mm)}` };
    }

    return { mode: 'days', text: `${dayDiff}d` };
}
