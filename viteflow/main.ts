import { dispatch } from './router';

dispatch(
	window.location.pathname + window.location.search + window.location.hash,
);

if (import.meta.hot) {
	import.meta.hot.accept('./router', (newMod) => {
		if (newMod && typeof newMod.dispatch === 'function') {
			newMod.dispatch(
				window.location.pathname +
					window.location.search +
					window.location.hash,
			);
		}
	});
}
