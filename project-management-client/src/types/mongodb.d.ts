/** Ambient alias so shared-models interfaces can reference ObjectId without a real mongodb import. */
declare module 'mongodb' {
    export type ObjectId = string;
}
