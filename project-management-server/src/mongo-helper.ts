import { MongoClient, Db, Collection, ObjectId, Filter, UpdateFilter,
         FindOptions, UpdateOptions, DeleteOptions, Document } from 'mongodb';

/** Thin wrapper around MongoClient. Construct once at startup; share across all DB services. */
export class MongoHelper {

    constructor(
        private readonly connectionString: string,
        private readonly databaseName: string,
    ) { }

    private client: MongoClient | undefined;
    private db: Db | undefined;
    private intentionalDisconnect = false;

    get isConnected(): boolean {
        return this.client !== undefined;
    }

    /** Connects to MongoDB. Called once at startup by the container. */
    async connect(): Promise<void> {
        this.intentionalDisconnect = false;
        this.client = new MongoClient(this.connectionString);
        await this.client.connect();
        this.db = this.client.db(this.databaseName);
        console.log(`MongoDB connected: ${this.databaseName}`);

        // Auto-reconnect on unexpected close.
        this.client.on('close', () => {
            if (!this.intentionalDisconnect) {
                console.warn('MongoDB connection lost — reconnecting...');
                this.connect().catch(console.error);
            }
        });
    }

    /** Disconnects intentionally (e.g. on process shutdown). */
    async disconnect(): Promise<void> {
        this.intentionalDisconnect = true;
        await this.client?.close();
        this.client = undefined;
        this.db = undefined;
    }

    /** Returns a typed collection handle. */
    getCollection<T extends Document>(name: string): Collection<T> {
        if (!this.db) {
            throw new Error('MongoHelper: not connected.');
        }

        return this.db.collection<T>(name);
    }

    /** Generic find-one or find-many helper. */
    async findDataItem<T extends Document, Q extends Filter<T>>(
        collectionName: string,
        query: Q,
        options: { findOne: true } & FindOptions
    ): Promise<(T & { _id: ObjectId }) | undefined>;
    async findDataItem<T extends Document, Q extends Filter<T>>(
        collectionName: string,
        query: Q,
        options?: { findOne?: false } & FindOptions
    ): Promise<(T & { _id: ObjectId })[]>;
    async findDataItem<T extends Document, Q extends Filter<T>>(
        collectionName: string,
        query: Q,
        options?: { findOne?: boolean } & FindOptions
    ): Promise<(T & { _id: ObjectId }) | (T & { _id: ObjectId })[] | undefined> {
        const col = this.getCollection<T>(collectionName);

        if (options?.findOne) {
            const result = await col.findOne(query, options);
            return nullToUndefined(result) as (T & { _id: ObjectId }) | undefined;
        }

        return col.find(query, options).toArray() as Promise<(T & { _id: ObjectId })[]>;
    }

    /** Upserts a document (insert if no _id, replace if _id present). */
    async upsertDataItem<T extends Document>(
        collectionName: string,
        item: Partial<T> & { _id?: ObjectId }
    ): Promise<T & { _id: ObjectId }> {
        const col = this.getCollection<T>(collectionName);

        if (!item._id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await col.insertOne(item as any);
            return { ...item, _id: result.insertedId } as unknown as T & { _id: ObjectId };
        }

        await col.replaceOne({ _id: item._id } as Filter<T>, item as unknown as T, { upsert: true });
        return item as unknown as T & { _id: ObjectId };
    }

    /** Updates matching documents. */
    async updateDataItems<T extends Document>(
        collectionName: string,
        filter: Filter<T>,
        update: UpdateFilter<T>,
        options?: UpdateOptions
    ): Promise<void> {
        const col = this.getCollection<T>(collectionName);
        await col.updateMany(filter, update, options);
    }

    /** Deletes matching documents. */
    async deleteDataItems<T extends Document>(
        collectionName: string,
        filter: Filter<T>,
        options?: DeleteOptions
    ): Promise<void> {
        const col = this.getCollection<T>(collectionName);
        await col.deleteMany(filter, options);
    }
}

/** Converts MongoDB's null returns to undefined at the boundary. */
function nullToUndefined<T>(value: T | null): T | undefined {
    return value === null ? undefined : value;
}
