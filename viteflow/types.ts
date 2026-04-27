export type RouteContext = {
	params: Record<string, string>;
	path: string;
};

export type RouteHandler = (ctx: RouteContext) => void | Promise<void>;

export type RouteModule = {
	default: RouteHandler;
};
