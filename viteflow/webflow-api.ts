const API_BASE = 'https://api.webflow.com/v2';

export type Asset = {
	id: string;
	originalFileName?: string;
	displayName?: string;
	hostedUrl?: string;
	assetUrl?: string;
};

export type CreateAssetResponse = {
	id: string;
	uploadUrl: string;
	uploadDetails: Record<string, string>;
	hostedUrl?: string;
	assetUrl?: string;
	contentType?: string;
};

export type RegisteredScript = {
	id: string;
	displayName?: string;
	hostedLocation?: string;
	integrityHash?: string;
	version?: string;
};

export type AppliedScript = {
	id: string;
	location: 'header' | 'footer';
	version: string;
	attributes?: Record<string, string>;
};

export type AppliedCustomCodeBlock = {
	type: 'site' | 'page';
	scripts?: AppliedScript[];
};

export class WebflowApiError extends Error {
	status: number;
	body: string;
	constructor(status: number, body: string, message: string) {
		super(message);
		this.status = status;
		this.body = body;
	}
}

export class WebflowApi {
	private token: string;
	private siteId: string;

	constructor(token: string, siteId: string) {
		this.token = token;
		this.siteId = siteId;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
	): Promise<T> {
		const res = await fetch(`${API_BASE}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				accept: 'application/json',
				...(body !== undefined ? { 'content-type': 'application/json' } : {}),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});

		if (!res.ok) {
			const text = await res.text();
			throw new WebflowApiError(
				res.status,
				text,
				`Webflow API ${method} ${path} → ${res.status} ${res.statusText}: ${text}`,
			);
		}

		if (res.status === 204) return undefined as T;
		const ct = res.headers.get('content-type') ?? '';
		if (!ct.includes('application/json')) return undefined as T;
		return (await res.json()) as T;
	}

	async listAssets(): Promise<Asset[]> {
		const all: Asset[] = [];
		const limit = 100;
		let offset = 0;
		while (true) {
			const res = await this.request<{ assets?: Asset[] }>(
				'GET',
				`/sites/${this.siteId}/assets?limit=${limit}&offset=${offset}`,
			);
			const page = res.assets ?? [];
			all.push(...page);
			if (page.length < limit) break;
			offset += limit;
		}
		return all;
	}

	async createAsset(
		fileName: string,
		fileHashMd5: string,
	): Promise<CreateAssetResponse> {
		return this.request<CreateAssetResponse>(
			'POST',
			`/sites/${this.siteId}/assets`,
			{ fileName, fileHash: fileHashMd5 },
		);
	}

	async uploadAssetBinary(
		uploadUrl: string,
		uploadDetails: Record<string, string>,
		bytes: Uint8Array,
		contentType: string,
		fileName: string,
	): Promise<void> {
		const form = new FormData();
		for (const [key, value] of Object.entries(uploadDetails)) {
			form.append(key, value);
		}
		form.append(
			'file',
			new Blob([bytes as BlobPart], { type: contentType }),
			fileName,
		);
		const res = await fetch(uploadUrl, { method: 'POST', body: form });
		if (!res.ok) {
			const text = await res.text();
			throw new WebflowApiError(
				res.status,
				text,
				`S3 upload → ${res.status} ${res.statusText}: ${text}`,
			);
		}
	}

	async deleteAsset(assetId: string): Promise<void> {
		await this.request('DELETE', `/assets/${assetId}`);
	}

	async listRegisteredScripts(): Promise<RegisteredScript[]> {
		const res = await this.request<{ registeredScripts?: RegisteredScript[] }>(
			'GET',
			`/sites/${this.siteId}/registered_scripts`,
		);
		return res.registeredScripts ?? [];
	}

	async registerHostedScript(input: {
		hostedLocation: string;
		integrityHash: string;
		version: string;
		displayName: string;
		canCopy?: boolean;
	}): Promise<RegisteredScript> {
		return this.request<RegisteredScript>(
			'POST',
			`/sites/${this.siteId}/registered_scripts/hosted`,
			input,
		);
	}

	async deleteRegisteredScript(scriptId: string): Promise<void> {
		await this.request(
			'DELETE',
			`/sites/${this.siteId}/registered_scripts/${scriptId}`,
		);
	}

	async getAppliedCustomCode(): Promise<AppliedScript[]> {
		const res = await this.request<{ scripts?: AppliedScript[] }>(
			'GET',
			`/sites/${this.siteId}/custom_code`,
		);
		return res.scripts ?? [];
	}

	async upsertCustomCode(scripts: AppliedScript[]): Promise<void> {
		await this.request('PUT', `/sites/${this.siteId}/custom_code`, { scripts });
	}

	async publish(input: {
		publishToWebflowSubdomain: boolean;
		customDomains?: string[];
	}): Promise<void> {
		await this.request('POST', `/sites/${this.siteId}/publish`, input);
	}
}
