import { Task } from '../../model/shared-models/task.model';
import { Group } from '../../model/shared-models/group.model';
import { Layout } from '../../model/shared-models/layout.model';
import { TaskUrgency } from '../../model/shared-models/task-urgency.enum';

/**
 * Collapses a 2D canvas layout of a parent task's direct children into a 1D
 * "reading order" — the order a person's eye would read the cards: rows top to
 * bottom, and left to right within a row.
 *
 * Geometry is only applied at the top (free) level. Each group competes for a
 * rank as a single bounding box, then expands in place into its members in their
 * declared `itemIds` order (the group's reflow already guarantees that sequence
 * matches its visual order). This mirrors the user's model: "if a group's order
 * is 10, its items get inserted where 10 would be, in their own internal order."
 */

/**
 * Fraction of the shorter box's height that two boxes must overlap vertically to
 * count as being on the same row. Higher = stricter (near-aligned cards split
 * into separate rows more easily); lower = looser (a gentle staircase collapses
 * into one row). This is the single tuning knob; everything else is deterministic.
 */
export const ROW_OVERLAP_RATIO = 0.4;

/** Higher rank = more urgent = sorts earlier when used as a positional tiebreaker. */
const URGENCY_RANK: Record<TaskUrgency, number> = {
    [TaskUrgency.Immediate]:    5,
    [TaskUrgency.Urgent]:       4,
    [TaskUrgency.Important]:    3,
    [TaskUrgency.Normal]:       2,
    [TaskUrgency.Low]:          1,
    [TaskUrgency.LongTermGoal]: 0,
};

function urgencyRank(urgency: TaskUrgency | undefined): number {
    return urgency !== undefined ? (URGENCY_RANK[urgency] ?? 0) : 0;
}

/** A single unit competing in the top-level geometric ordering. */
interface OrderUnit {
    /** Bounding box used for banding/sorting (a loose task's box, or a group's box). */
    box: Layout;
    /** Representative urgency (max among members) for the positional tiebreaker. */
    urgencyRank: number;
    /** Task ids this unit contributes, already in the order they should appear. */
    memberTaskIds: string[];
}

/**
 * Returns all of a parent's direct-child task ids in reading order.
 *
 * @param tasks  the parent's direct children (all of them, regardless of the
 *               `projectToParent` flag — ordering is independent of projection).
 * @param groups the groups on the parent's canvas.
 */
export function computeProjectionOrder(tasks: Task[], groups: Group[]): string[] {
    const idOf = (t: Task) => (t._id as unknown as { toString(): string }).toString();
    const taskById = new Map<string, Task>();
    for (const t of tasks) { taskById.set(idOf(t), t); }

    // Membership is sourced from group.itemIds (the authoritative, ordered list).
    const groupedIds = new Set<string>();
    for (const g of groups) {
        for (const id of g.itemIds) {
            if (taskById.has(id)) { groupedIds.add(id); }
        }
    }

    const units: OrderUnit[] = [];

    // Loose tasks (not in any group) → one singleton unit each.
    for (const t of tasks) {
        const id = idOf(t);
        if (groupedIds.has(id)) { continue; }
        units.push({ box: t.layout, urgencyRank: urgencyRank(t.urgency), memberTaskIds: [id] });
    }

    // Groups → one unit each; members kept in itemIds order, tasks only.
    for (const g of groups) {
        const members = g.itemIds.filter(id => taskById.has(id));
        if (members.length === 0) { continue; }
        const maxRank = members.reduce(
            (max, id) => Math.max(max, urgencyRank(taskById.get(id)!.urgency)), 0);
        units.push({ box: g.layout, urgencyRank: maxRank, memberTaskIds: members });
    }

    const result: string[] = [];
    for (const unit of bandAndSortUnits(units)) {
        result.push(...unit.memberTaskIds);
    }
    return result;
}

/** Bands units into rows, orders rows top→down and members left→right. */
function bandAndSortUnits(units: OrderUnit[]): OrderUnit[] {
    if (units.length <= 1) { return units; }

    const rows = bandIntoRows(units);

    // Within each row: left → right, then top, then urgency, then stable by id.
    for (const row of rows) { row.sort(compareWithinRow); }

    // Rows: top → down by the row's highest edge, then leftmost edge.
    rows.sort((a, b) => {
        const aTop = Math.min(...a.map(u => u.box.y));
        const bTop = Math.min(...b.map(u => u.box.y));
        if (aTop !== bTop) { return aTop - bTop; }
        const aLeft = Math.min(...a.map(u => u.box.x));
        const bLeft = Math.min(...b.map(u => u.box.x));
        return aLeft - bLeft;
    });

    return rows.flat();
}

/**
 * Partitions units into rows via connected components of the "same row" relation
 * (transitive closure of vertical overlap). Union-find keeps this stable and
 * transitive — avoiding the inconsistent-comparator trap of a fuzzy "if they
 * overlap compare by x else by y" sort.
 */
function bandIntoRows(units: OrderUnit[]): OrderUnit[][] {
    const n = units.length;
    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (i: number): number => {
        while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
        return i;
    };
    const union = (a: number, b: number): void => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) { parent[ra] = rb; }
    };

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (sameRow(units[i].box, units[j].box)) { union(i, j); }
        }
    }

    const rows = new Map<number, OrderUnit[]>();
    for (let i = 0; i < n; i++) {
        const root = find(i);
        const row = rows.get(root);
        if (row) { row.push(units[i]); } else { rows.set(root, [units[i]]); }
    }
    return [...rows.values()];
}

/** Two boxes share a row when they overlap vertically by enough of the shorter one. */
function sameRow(a: Layout, b: Layout): boolean {
    const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    if (overlap <= 0) { return false; }
    const shorter = Math.min(a.height, b.height);
    if (shorter <= 0) { return false; }
    return overlap >= ROW_OVERLAP_RATIO * shorter;
}

function compareWithinRow(a: OrderUnit, b: OrderUnit): number {
    if (a.box.x !== b.box.x) { return a.box.x - b.box.x; }      // leftmost first
    if (a.box.y !== b.box.y) { return a.box.y - b.box.y; }      // then upper
    if (a.urgencyRank !== b.urgencyRank) { return b.urgencyRank - a.urgencyRank; } // more urgent first
    // Final deterministic tiebreak so the order never depends on input ordering.
    const aid = a.memberTaskIds[0], bid = b.memberTaskIds[0];
    return aid < bid ? -1 : aid > bid ? 1 : 0;
}
