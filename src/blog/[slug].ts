import type { RouteHandler } from '../../viteflow/types';

const handler: RouteHandler = ({ params }) => {
	console.log('[viteflow:blog/slug] post:', params.slug);
};

export default handler;
