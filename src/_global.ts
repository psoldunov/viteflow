import type { RouteHandler } from '../viteflow/types';
import './styles.css';

const handler: RouteHandler = ({ path }) => {
	console.log('[viteflow:global] page loaded:', path);
	if (import.meta.env.DEV) {
		document.documentElement.setAttribute('data-viteflow-loaded', '');
	}
};

export default handler;
