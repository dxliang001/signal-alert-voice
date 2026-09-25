# Signal project guidance

- Primary source: `dist/index.html`; this is a static ChatGPT Site.
- Preserve `.openai/hosting.json` and its `project_id` so future Sites publication targets the existing project.
- Keep the two visible categories: Urgent / Job and Low Priority / Subscription.
- Low priority alerts play a sound only. Urgent alerts play a distinct sound and a spoken phrase.
- Newsletters and subscriptions stay low priority. Urgent wording alone from an untrusted sender does not make a message urgent.
- The current version is a sample-message prototype. Do not claim it receives live email or texts without adding and verifying real integrations.
- Test the examples: two urgent and three low priority. Verify that low priority does not speak and urgent does.
