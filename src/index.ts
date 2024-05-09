export interface Env {
	AI: Ai;
	R2: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const ai = env.AI;
		const url = new URL(request.url);
		const params = url.searchParams;

		const inputs = {
			prompt: params.get('prompt') ?? 'small black cat',
		};

		let response: Uint8Array = new Uint8Array();

		try {
			response = await ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', inputs);
		} catch (e) {
			if (e instanceof Error) {
				return new Response(e.name + '\n' + e.message + '\n' + e.stack, { status: 500 });
			}
		}

		ctx.waitUntil(env.R2.put((params.get('prompt') ?? 'small black cat') + '/' + request.headers.get('cf-ray') + '.png', response));

		return new Response(response, {
			headers: {
				'content-type': 'image/png',
			},
		});
	},
};
