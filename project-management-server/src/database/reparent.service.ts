import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { TOKENS } from '../tokens';
import { MongoHelper } from '../mongo-helper';
import { TaskDbService } from './tasks/task-db.service';
import { NoteDbService } from './notes/note-db.service';
import { GroupDbService } from './groups/group-db.service';
import { DashboardDbService } from './dashboards/dashboard-db.service';
import { ProjectionOrderService } from './projection-order.service';
import { DbCollectionNames } from '../model/db-collection-names.constants';
import { Task } from '../model/shared-models/task.model';
import { Note } from '../model/shared-models/note.model';
import { Group } from '../model/shared-models/group.model';
import { Dashboard } from '../model/shared-models/dashboard.model';

/** Thrown by ReparentService to signal a specific HTTP status to the router. */
export class ReparentError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'ReparentError';
    }
}

/**
 * Moves canvas items between workspaces by changing their owning parent task.
 *
 * A "workspace" is the set of items sharing one `parentTaskId` (or no parent — the
 * project root). Reparenting an item changes that ownership while keeping the item's
 * `layout` untouched, so it lands at the same coordinates in the destination workspace.
 *
 * Tasks own a subtree: when a task moves, every descendant task/note/dashboard has the
 * portion of its `ancestorTaskIds` up to the moved task rewritten to reflect the new
 * position. Groups own their member tasks: when a group moves, each member task moves
 * with it (keeping group membership).
 */
@injectable()
export class ReparentService {

    constructor(
        @inject(TOKENS.TaskDbService)          private readonly tasks: TaskDbService,
        @inject(TOKENS.NoteDbService)          private readonly notes: NoteDbService,
        @inject(TOKENS.GroupDbService)         private readonly groups: GroupDbService,
        @inject(TOKENS.DashboardDbService)     private readonly dashboards: DashboardDbService,
        @inject(TOKENS.MongoHelper)            private readonly dbHelper: MongoHelper,
        @inject(TOKENS.ProjectionOrderService) private readonly projectionOrder: ProjectionOrderService,
    ) { }

    /** Ancestor chain a child placed under `newParentTaskId` should have (empty at root). */
    private async ancestorsUnder(newParentTaskId: ObjectId | null): Promise<ObjectId[]> {
        if (!newParentTaskId) { return []; }
        const parent = await this.tasks.findById(newParentTaskId);
        if (!parent) { throw new ReparentError(404, 'New parent task not found'); }
        return [...(parent.ancestorTaskIds ?? []), parent._id];
    }

    /**
     * Moves a task to a new parent (or to the project root when `newParentTaskId` is null).
     * Rewrites descendant ancestor chains. Clears group membership unless `keepGroup` is set
     * (group reparenting carries its members and wants to keep them grouped).
     */
    async reparentTask(
        taskId: ObjectId,
        newParentTaskId: ObjectId | null,
        opts?: { keepGroup?: boolean },
    ): Promise<Task> {
        const task = await this.tasks.findById(taskId);
        if (!task) { throw new ReparentError(404, 'Task not found'); }

        if (newParentTaskId) {
            if (newParentTaskId.equals(taskId)) {
                throw new ReparentError(400, 'A task cannot be its own parent');
            }
            const descendants = await this.tasks.findDescendants(taskId);
            if (descendants.some(d => d._id.equals(newParentTaskId))) {
                throw new ReparentError(400, 'A task cannot be moved into its own subtree');
            }
        }

        const oldParentId = task.parentTaskId ?? null;
        const newAncestors = await this.ancestorsUnder(newParentTaskId);

        const merged: any = { ...task, ancestorTaskIds: newAncestors };
        if (newParentTaskId) { merged.parentTaskId = newParentTaskId; }
        else { delete merged.parentTaskId; }
        if (!opts?.keepGroup) { delete merged.groupId; delete merged.preGroupLayout; }

        const updated = await this.tasks.update(merged);
        await this.rewriteDescendantChains(taskId, newAncestors);

        this.projectionOrder.scheduleRecompute(oldParentId);
        this.projectionOrder.scheduleRecompute(newParentTaskId);
        return updated;
    }

    /** Moves a note to a new parent (or project root). Notes have no descendants. */
    async reparentNote(noteId: ObjectId, newParentTaskId: ObjectId | null): Promise<Note> {
        const note = await this.notes.findById(noteId);
        if (!note) { throw new ReparentError(404, 'Note not found'); }

        const newAncestors = await this.ancestorsUnder(newParentTaskId);
        const merged: any = { ...note, ancestorTaskIds: newAncestors };
        if (newParentTaskId) { merged.parentTaskId = newParentTaskId; }
        else { delete merged.parentTaskId; }

        const updated = await this.notes.update(merged);
        this.projectionOrder.scheduleRecompute(note.parentTaskId ?? null);
        this.projectionOrder.scheduleRecompute(newParentTaskId);
        return updated;
    }

    /** Moves a dashboard to a new parent (or project root). Dashboards have no descendants. */
    async reparentDashboard(dashboardId: ObjectId, newParentTaskId: ObjectId | null): Promise<Dashboard> {
        const dashboard = await this.dashboards.findById(dashboardId);
        if (!dashboard) { throw new ReparentError(404, 'Dashboard not found'); }

        const newAncestors = await this.ancestorsUnder(newParentTaskId);
        const merged: any = { ...dashboard, ancestorTaskIds: newAncestors };
        if (newParentTaskId) { merged.parentTaskId = newParentTaskId; }
        else { delete merged.parentTaskId; }

        const updated = await this.dashboards.update(merged);
        this.projectionOrder.scheduleRecompute(dashboard.parentTaskId ?? null);
        this.projectionOrder.scheduleRecompute(newParentTaskId);
        return updated;
    }

    /**
     * Moves a group to a new parent (or project root), carrying its member tasks (and
     * their subtrees) with it. Member tasks keep their group membership and layout.
     */
    async reparentGroup(groupId: ObjectId, newParentTaskId: ObjectId | null): Promise<Group> {
        const group = await this.groups.findById(groupId);
        if (!group) { throw new ReparentError(404, 'Group not found'); }

        const oldParentId = group.parentTaskId ?? null;
        const merged: any = { ...group };
        if (newParentTaskId) { merged.parentTaskId = newParentTaskId; }
        else { delete merged.parentTaskId; }

        const updated = await this.groups.update(merged);

        for (const memberId of group.itemIds) {
            try {
                await this.reparentTask(new ObjectId(memberId), newParentTaskId, { keepGroup: true });
            } catch {
                // A stale member id (already moved/deleted) should not abort the group move.
            }
        }

        this.projectionOrder.scheduleRecompute(oldParentId);
        this.projectionOrder.scheduleRecompute(newParentTaskId);
        return updated;
    }

    /** Rewrites the ancestor chain prefix of every descendant task, note, and dashboard. */
    private async rewriteDescendantChains(anchorId: ObjectId, newAncestors: ObjectId[]): Promise<void> {
        await Promise.all([
            this.dbHelper.rewriteAncestorPrefix(DbCollectionNames.Tasks, anchorId, newAncestors),
            this.dbHelper.rewriteAncestorPrefix(DbCollectionNames.Notes, anchorId, newAncestors),
            this.dbHelper.rewriteAncestorPrefix(DbCollectionNames.Dashboards, anchorId, newAncestors),
        ]);
    }
}
