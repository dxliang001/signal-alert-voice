# Signal — Voice Alerts for Messages That Actually Matter

Signal is a browser prototype that decides which emails and texts are worth interrupting you for. Urgent school or work messages play a distinct tone and say *"Urgent message. Please check."* Low-priority alerts play a soft sound only when sound is enabled. Messages are entered manually or loaded from synthetic examples; no live inbox or SMS is connected.

**Live demo:** https://signal-alert-voice.dxliang.chatgpt.site


## The problem

Students and early-career professionals get a steady stream of newsletters, promotions, and group updates. Mixed in are a few messages that need action now: a shift to cover in 20 minutes, an assignment due tonight, a recruiter waiting for confirmation. Most notification systems treat these the same way, so people either miss the important ones or learn to ignore alerts entirely.

The hard part is not playing a sound. It is deciding **what counts as useful and urgent**, and doing it in a way the user can inspect and correct.

## How a message is analyzed

The rules run in order. Every card shows **“Why this category?”** with the deciding rule and matching evidence.

1. Subscription rules, flags and wording select Low Priority, even for an always-urgent contact.
2. An unrecognizable sender selects Low Priority.
3. A matching “always urgent” rule selects Urgent; it does not require a separate trusted-contact match or urgent phrase.
4. Other senders must match a trusted address, phone or exact domain. Urgent wording cannot grant trust.
5. Trusted senders qualify through a current same-day deadline, an action within an hour, or a recognized immediate-request phrase. Otherwise the message is Low Priority.

Recognized “no rush” and resolved/canceled/postponed context suppress urgency within a clause. A body update also suppresses an old urgent subject, while a separate current body request can still qualify. These are narrow phrase rules, not semantic understanding or sender authentication.

Some design decisions behind the rules:

| Decision | Why | Example case |
|---|---|---|
| Subscription signals beat trust | A newsletter from your school is still a newsletter. | `trusted-newsletter` |
| Urgent wording cannot create trust | "URGENT: verify your account" from a stranger is the classic scam pattern. | `unknown-urgent`, `unknown-password` |
| Exact sender matching only | `campus-example.com` and `mail.campus.example` should not inherit trust from `campus.example`. | `lookalike-domain`, `untrusted-subdomain` |
| The real mailbox beats the display name | `"Professor Lee" <random@other.example>` is not the professor. | `trusted-name-untrusted-address` |
| "Resolved" and "no rush" apply only to their own sentence | "The outage is resolved. Please join the call in 10 minutes." is still urgent. | `resolved-then-action` |
| Time alone is not enough | "The meeting lasts one hour" has a time but no request. | `routine-duration`, `plain-near-time` |
| Quoted history is ignored | An old "ASAP" in a reply thread is not a new request. | `quoted-urgency` |

Full rule details are in [docs/how-it-works.md](docs/how-it-works.md).

## Evaluation and error analysis

[`tests/classification-cases.json`](tests/classification-cases.json) contains **46 synthetic messages** (13 urgent, 33 low priority), each with an expected category and a one-line rationale. The cases cover school and work requests, stale subjects, negation, scam-like pressure, lookalike domains, and sender-parsing edge cases.

| Rule version | Urgent messages missed | Unnecessary urgent alerts | Cases matching expectation |
|---|---|---|---|
| Previous rules (whole-message keyword matching) | 3 | 9 | 34 / 46 |
| Current rules | 0 | 0 | 46 / 46 |

What the previous rules got wrong, grouped by cause:

| Failure pattern | Cases | Example | Fix |
|---|---|---|---|
| Real requests with no urgency keyword | 2 missed | "Can you cover my shift in 20 minutes?" | Recognize an action verb + a time window of 60 minutes or less |
| One "no rush" silenced the whole message | 1 missed | "No rush on the report, but call me now about the delivery." | Split into clauses; "no rush" applies only to its own clause |
| Stale context still triggered voice | 5 false alarms | Subject "URGENT outage", body "The outage is resolved." | Resolved / canceled / extended in the body overrides an old subject; ignore `>` quoted lines |
| Trust leaked through the sender field | 4 false alarms | `"professor@campus.example" <fraud@unknown.example>` | Parse exactly one mailbox or phone; never match addresses inside display names or free text |

The misses came from depending on keywords. The false alarms came from ignoring context and from loose sender matching.

**Caveat:** I wrote this set and tuned the rules against it, so it is a regression suite, not an independent accuracy estimate for real inboxes.

## Known limitations

- **Useful is not the same as urgent.** With two buckets, "interview scheduled for next Tuesday" or "assignment due tomorrow" lands in Low Priority next to newsletters. These are exactly the messages students most want to keep.
- Sorting uses phrase matching, not semantic understanding. Complex negation, absolute dates ("due Oct 3"), and unfamiliar phrasing can be misclassified.
- **Priority is not a safety verdict.** The demo cannot authenticate senders; a spoofed exact trusted address still matches.
- No live inbox or SMS is connected. Messages are entered manually or loaded from examples.

## Future directions

1. **Value × urgency instead of a single urgent flag.** High value + time-sensitive → voice alert; high value + not time-sensitive → normal notification or daily digest; low value → quiet.
2. **Independent evaluation.** After privacy safeguards are in place, evaluate consented examples with a separate held-out set and report aggregate errors without publishing private message content.
3. **Real inbox integration.** Explore consent-based email access only after account and privacy safeguards. No live inbox is connected to this browser prototype.

## Features

- Two columns: **Urgent / Job** and **Low Priority / Subscription**
- Trusted contacts by exact email, domain, or phone number, saved in the browser
- Per-card one-time moves and saved sender rules; changing a rule re-sorts the inbox silently
- Example sets: standard, "tricky" edge cases, and scam-like messages
- Sequential audio queue so one urgent announcement is not cut off by the next message

## Run it

The app is a single static file with no build step. Open `dist/index.html` in a browser.

Tests (Node.js 22+):

```sh
node --test --experimental-test-isolation=none tests/classification.test.cjs tests/prototype.test.cjs
```

The tests cover classification, sender-rule persistence, and alert sequencing with mocked browser audio APIs. They do not verify audible output from speakers.

## Tech

HTML, CSS, vanilla JavaScript, Web Audio API, Web Speech API, `node:test`. Built with AI coding assistance, with project work focused on classification rules, regression cases, error analysis and inspectable decisions. This is a rule-based prototype, not a trained machine-learning classifier.

Keep .openai/hosting.json and its project ID intact for future Site publication. Updating GitHub does not automatically publish the Site.

