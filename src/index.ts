import { Agent, routeAgentEmail, routeAgentRequest } from 'agents';
import { type AgentEmail } from 'agents/email';
import PostalMime from 'postal-mime';

export class SupportAgent extends Agent<Env> {
	async onEmail(email: AgentEmail) {
		const raw = await email.getRaw();
		const parsed = await PostalMime.parse(raw);

		console.log('Subject:', parsed.subject);
		console.log('From:', parsed.from);
		console.log('Text body:', parsed.text);
	}
}

export default {
	async email(message, env) {
		await routeAgentEmail(message, env, {
			resolver: async (email) => ({
				agentName: 'SupportAgent',
				agentId: email.from,
			}),
		});
	},
	async fetch(request: Request, env: Env) {
		return (await routeAgentRequest(request, env)) || new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
