export class BaseRepository {
	constructor(db) {
		this.db = db;
	}

	async execute(query, params = []) {
		return await this.db
			.prepare(query)
			.bind(...params)
			.all();
	}

	async first(query, params = []) {
		return await this.db
			.prepare(query)
			.bind(...params)
			.first();
	}

	async run(query, params = []) {
		return await this.db
			.prepare(query)
			.bind(...params)
			.run();
	}
}
