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
			let hint = '';
			if (res.status === 403 && text.includes('invalid_auth_version')) {
				hint =
					'\n\n[viteflow] 403 invalid_auth_version. Common causes:' +
					'\n  1. WEBFLOW_SITE_ID points to a site this token cannot access. Check ' +
					'`curl -H "Authorization: Bearer $WEBFLOW_API_TOKEN" https://api.webflow.com/v2/sites`.' +
					'\n  2. Token is a legacy v1 site token. Generate a fresh one at ' +
					'Webflow → Site Settings → Apps & Integrations → API access.';
			} else if (res.status === 403 && text.includes('missing_scopes')) {
				hint =
					'\n\n[viteflow] Token is missing required scopes. ' +
					'Regenerate it with assets:read and assets:write.';
			}
			throw new WebflowApiError(
				res.status,
				text,
				`Webflow API ${method} ${path} → ${res.status} ${res.statusText}: ${text}${hint}`,
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
}
