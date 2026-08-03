export function createWorkerContext(env) {
	return {
		env,
		startedAt: Date.now(),
	};
}
