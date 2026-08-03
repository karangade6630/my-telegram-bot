export class D1Database {
	constructor(db) {
		this.db = db;
	}

	async init(schemaSql) {
		if (!this.db) {
			throw new Error('D1 database binding is missing.');
		}

		await this.db.exec(schemaSql);
		return this;
	}
}
