import { resolve, extname, relative, isAbsolute } from "node:path";

import "./cwd";

const port = 4173;
const rootDir = resolve(process.cwd(), "manual-test");

const contentTypes: Record<string, string> = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
};

const respondWithFile = async (filePath: string) => {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		return new Response("Not found", { status: 404 });
	}

	return new Response(file, {
		headers: {
			"Content-Type":
				contentTypes[extname(filePath)] ?? "application/octet-stream",
			"Cache-Control": "no-store",
		},
	});
};

const server = Bun.serve({
	port,
	hostname: "127.0.0.1",
	async fetch(request) {
		const url = new URL(request.url);
		const pathname =
			url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
		const filePath = resolve(rootDir, `.${pathname}`);
		const fileRelativePath = relative(rootDir, filePath);

		if (
			fileRelativePath.startsWith("..") ||
			isAbsolute(fileRelativePath)
		) {
			return new Response("Forbidden", { status: 403 });
		}

		return respondWithFile(filePath);
	},
});

console.log(`Manual test page available at http://localhost:${server.port}`);
console.log("Open it in a browser with the unpacked extension loaded.");
