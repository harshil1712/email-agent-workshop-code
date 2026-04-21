import { Agent, routeAgentRequest } from 'agents';

export class SupportAgent extends Agent<Env> {}

export default {
	async fetch(request: Request, env: Env) {
		return (await routeAgentRequest(request, env)) || new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
