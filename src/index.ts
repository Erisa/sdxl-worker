import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { logger } from 'hono/logger';
import { Ai } from '@cloudflare/ai';

import indexHtml from './public/index.html';

type Bindings = {
	AI: Ai;
	R2: R2Bucket;
};

interface BodyInputs {
	prompt: string;
	num_steps?: number;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(
	'*',
	cors({
		origin: 'https://mecha-muse.twizy.workers.dev',
		allowHeaders: ['*'],
		allowMethods: ['POST', 'GET'],
		maxAge: 600,
	}),
);
app.use(logger());
app.use(prettyJSON());

app.get('/', async (c: Context) => {
	c.header('Content-Type', 'text/html');
	return c.body(indexHtml);
});

app.post('/', async (c: Context) => {
	const body = await c.req.json();
	const ai = new Ai(c.env.AI);

	if (!body.prompt) {
		c.header('Content-Type', 'application/json');
		return c.json({ message: 'Prompt is required', ok: false }, 400);
	}

	if (body.num_steps && (body.num_steps < 1 || body.num_steps > 20)) {
		c.header('Content-Type', 'application/json');
		return c.json({ message: 'Number of steps must be between 1 and 20', ok: false }, 400);
	}

	const inputs: BodyInputs = {
		prompt: body.prompt,
		num_steps: body.num_steps || 20,
	};

	let response: Uint8Array = new Uint8Array();

	try {
		response = await ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', inputs);
	} catch (e) {
		if (e instanceof Error) {
			c.header('Content-Type', 'application/json');
			console.error(e.message, e.stack, e.name);
			return c.json({ message: 'An error cccured - Please try again', ok: false }, 500);
		}
	}
	const key: string = c.req.header('cf-ray') + '.png';

	c.executionCtx.waitUntil(c.env.R2.put(key, response));

	c.header('Content-Type', 'image/png');
	return c.body(response);
});

export default app;
