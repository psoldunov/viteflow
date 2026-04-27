export type RouteContext = {
	params: Record<string, string>;
	path: string;
	searchParams: URLSearchParams;
	hash: string;
	id: string;
};

export type RouteHandler = (ctx: RouteContext) => void | Promise<void>;

export type RouteModule = {
	default: RouteHandler;
};
