import type { RouteHandler } from '../viteflow/types';

const handler: RouteHandler = () => {
	console.log('[viteflow:about] hello from /about');
};

export default handler;
