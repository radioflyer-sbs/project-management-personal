import { injectable } from 'inversify';
import { MongoHelper } from '../mongo-helper';

/** Abstract base class for all per-entity database services.
 *  Subclasses receive MongoHelper via their constructor. */
@injectable()
export abstract class DbService {

    constructor(protected readonly dbHelper: MongoHelper) { }
}
