import { Agent, routeAgentEmail, routeAgentRequest } from 'agents';
import { createAddressBasedEmailResolver, createSecureReplyEmailResolver, isAutoReplyEmail, type AgentEmail } from 'agents/email';
import PostalMime from 'postal-mime';
import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';

const SLIDES_LINK = 'https://harshil.dev/slides/email-agent-workshop';
const GITHUB_LINK = 'https://github.com/harshil1712/email-agent-workshop-code';

const SYSTEM_PROMPT = `You are an email assistant for a workshop. Attendees may email you to request workshop materials.

Your job is to determine if the sender is asking for workshop materials (slides, code, repo, resources, etc.) and generate appropriate responses.

- If the email is a request for workshop materials, respond with the material they are requesting. If they are not specific, provide the main materials (slides and GitHub repo). DO NOT provide any additional information. Keep a friendly and helpful tone.

- If the email is about anything else (questions, complaints, spam, unrelated topics), respond with EXACTLY this message and nothing else: IGNORE

Do NOT add any explanation.

Here are the workshop resources:
- Slidses: ${SLIDES_LINK}
- GitHub Repo: ${GITHUB_LINK}
`;

export class SendSlides extends Agent<Env> {
	async onEmail(email: AgentEmail) {
		const raw = await email.getRaw();
		const parsed = await PostalMime.parse(raw);

		if (isAutoReplyEmail(parsed.headers)) {
			console.log('Skipping auto-reply email');
			return;
		}

		console.log('Subject:', parsed.subject);
		console.log('From:', parsed.from);

		const workersai = createWorkersAI({ binding: this.env.AI });
		const { text } = await generateText({
			model: workersai('@cf/zai-org/glm-4.7-flash'),
			system: SYSTEM_PROMPT,
			prompt: parsed.text ?? '',
		});

		const decision = text.trim().toUpperCase();
		console.log('LLM decision:', decision, text);

		if (decision === 'IGNORE') {
			console.log('Ignoring non-workshop email');
			return;
		}

		await this.replyToEmail(email, {
			fromName: 'SendSlides',
			body: text,
			secret: this.env.EMAIL_SECRET,
		});
	}
}

export default {
	async email(message, env) {
		const secureResolver = createSecureReplyEmailResolver(env.EMAIL_SECRET, {
			maxAge: 7 * 24 * 60 * 60,
			onInvalidSignature: (email, reason) => {
				console.warn(`Invalid signature from ${email.from}: ${reason}`);
			},
		});
		const addressResolver = createAddressBasedEmailResolver('SendSlides');

		await routeAgentEmail(message, env, {
			resolver: async (email, env) => {
				const replyRouting = await secureResolver(email, env);
				if (replyRouting) return replyRouting;
				return addressResolver(email, env);
			},
			onNoRoute: (email) => {
				console.warn(`No route found for email from ${email.from}`);
				email.setReject('Unknown recipient');
			},
		});
	},

	async fetch(request: Request, env: Env) {
		return (await routeAgentRequest(request, env)) || new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
