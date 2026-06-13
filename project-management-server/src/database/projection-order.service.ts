import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { TOKENS } from '../tokens';
import { TaskDbService } from './tasks/task-db.service';
import { GroupDbService } from './groups/group-db.service';
import { computeProjectionOrder } from './tasks/projection-order.util';

/**
 * Trailing-debounce window (ms) that coalesces a burst of layout writes from one
 * UI transition (a drag, a resize, a group reflow — each persists several docs)
 * into a single recompute. Generous enough that the triggering writes have landed
 * before the pass reads them back.
 */
const COALESCE_MS = 300;

/**
 * Maintains each task's `projectionOrder` — its reading-order rank among its
 * parent's direct children — whenever that parent's canvas layout changes.
 *
 * The recompute is graph/tree work (overlap banding + group expansion), so it
 * runs as plain, testable TypeScript rather than in the database. It is triggered
 * on write (not on read), coalesced per parent task, so the cost is paid at most
 * once per layout transition and the read path stays a trivial `$sort`.
 */
@injectable()
export class ProjectionOrderService {

    constructor(
        @inject(TOKENS.TaskDbService)  private readonly tasks: TaskDbService,
        @inject(TOKENS.GroupDbService) private readonly groups: GroupDbService,
    ) { }

    private readonly timers = new Map<string, NodeJS.Timeout>();

    /**
     * Schedules a coalesced recompute for a parent task's children. No-op when
     * there is no parent (top-level tasks project to nothing). Repeated calls for
     * the same parent within the debounce window collapse into one pass.
     */
    scheduleRecompute(parentTaskId: ObjectId | undefined | null): void {
        if (!parentTaskId) { return; }
        const key = parentTaskId.toHexString();
        const existing = this.timers.get(key);
        if (existing) { clearTimeout(existing); }
        this.timers.set(key, setTimeout(() => {
            this.timers.delete(key);
            this.recomputeNow(parentTaskId).catch(err =>
                console.error(`Projection-order recompute failed for parent ${key}:`, err));
        }, COALESCE_MS));
    }

    /** Runs the ordering pass now and persists only the ranks that changed. */
    async recomputeNow(parentTaskId: ObjectId): Promise<void> {
        const [tasks, groups] = await Promise.all([
            this.tasks.findByParentTask(parentTaskId),
            this.groups.findByParentTask(parentTaskId),
        ]);
        if (tasks.length === 0) { return; }

        const orderedIds = computeProjectionOrder(tasks, groups);
        const rankById = new Map<string, number>();
        orderedIds.forEach((id, index) => rankById.set(id, index));

        const updates: { id: ObjectId; projectionOrder: number }[] = [];
        for (const task of tasks) {
            const next = rankById.get((task._id as unknown as { toString(): string }).toString());
            if (next !== undefined && task.projectionOrder !== next) {
                updates.push({ id: task._id, projectionOrder: next });
            }
        }
        await this.tasks.setProjectionOrders(updates);
    }
}
