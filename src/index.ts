import type { RouteHandler } from '../viteflow/types';

const handler: RouteHandler = () => {
	console.log('[viteflow:home] hello from /');
};

export default handler;
