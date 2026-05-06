export const VITEFLOW_BUNDLE_MARKER = 'data-viteflow-bundle';

export const VITEFLOW_BUNDLE_TAG_REGEX = new RegExp(
	`<script\\b[^>]*?(?<=[\\s"'])${VITEFLOW_BUNDLE_MARKER}(?=[\\s=>/])[^>]*>[\\s\\S]*?<\\/script>`,
	'gi',
);
