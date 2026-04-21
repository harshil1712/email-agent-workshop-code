import { Agent, routeAgentEmail, routeAgentRequest } from 'agents';
import { isAutoReplyEmail, type AgentEmail } from 'agents/email';
import PostalMime from 'postal-mime';
import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';

const SYSTEM_PROMPT = `You are the inbox agent for FastFlare Home Services,
a home services company offering cleaning, plumbing, and landscaping.

Your job is to:
- Read the customer's email and understand what they need
- Respond professionally and helpfully
- If they want to book a service, acknowledge it and confirm you'll arrange it
- If they ask about pricing or availability, provide what you know
- If you can't help, let them know a human will follow up

Available services: cleaning ($150), plumbing ($200 callout), landscaping ($300)
Business hours: Mon-Fri 8am-6pm
Emergency plumbing: available 24/7, $350 callout`;

export class SupportAgent extends Agent<Env> {
	async onEmail(email: AgentEmail) {
		const raw = await email.getRaw();
		const parsed = await PostalMime.parse(raw);

		if (isAutoReplyEmail(parsed.headers)) {
			console.log('Skipping auto-reply email');
			return;
		}

		console.log('Subject:', parsed.subject);
		console.log('From:', parsed.from);
		console.log('Text body:', parsed.text);

		const workersai = createWorkersAI({ binding: this.env.AI });
		const { text } = await generateText({
			model: workersai('@cf/zai-org/glm-4.7-flash'),
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: 'user',
					content: parsed.text || 'No text content',
				},
			],
		});

		console.log('Generated response:', text);

		await this.replyToEmail(email, {
			fromName: 'FastFlare Home Services',
			body: text,
		});
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
