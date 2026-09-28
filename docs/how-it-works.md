# How Signal Classifies Messages

This page contains the detailed rules. See the [README](../README.md) for the overview.

## Decision order

The first rule that applies decides the result.

1. **Subscription sender rule** (saved by the user) → Low priority
2. **Subscription flag** (checked on the form) → Low priority
3. **Subscription wording**: `unsubscribe`, `newsletter`, `subscription`, `weekly digest`, `special offer`, `promo code`, `flash sale` → Low priority
4. **Unclear sender**: the sender is not one recognizable email address or phone number → Low priority
5. **Always-urgent contact** (user override) → Urgent, without requiring a separate trusted-contact match or urgent phrase
6. **Untrusted sender** → Low priority. Urgent wording cannot grant trust.
7. **Trusted sender + current urgent signal** → Urgent
8. **Trusted sender, but context says it can wait** → Low priority
9. **Trusted sender, routine message** → Low priority

Subscription checks look at the whole subject and body, including quoted lines and footers. This can suppress a real urgent request when “unsubscribe” appears only in a footer.

## Sender matching

- Accepted identities: one complete email address, one `Name <address>` mailbox, or a phone number with 7–15 digits after normalization.
- In `Name <address>`, the address in angle brackets is used; an address inside the display name is ignored.
- Multiple addresses, addresses inside URLs or sentences, and arbitrary text are not trusted.
- Domain rules such as `@team.example` match that exact domain only, not lookalikes (`team-example.com`) or subdomains (`mail.team.example`).
- Phone rules cannot match digits inside an email address.
- Matching a typed sender value is **not** sender authentication. A spoofed exact trusted address still matches.

## Urgent signals (trusted senders only)

A message is urgent if any current clause contains:

- **Same-day deadline**: `due today`, `deadline is tonight`, `submit by today`, `reply by tonight`, `respond by today`
- **Action within an hour**: a time window of 60 minutes or less (`in 20 minutes`, `within the next hour`) together with an action verb such as cover, join, confirm, submit, reply, respond, call, attend, send, finish, complete, approve, or review
- **Immediate request**: `urgent`, `ASAP`, `immediately`, `emergency`, `outage`, `blocked`, `time-sensitive`, `right away`, `call me now`, `reply now`, `respond now`, `need you now`

A deadline tomorrow is not treated as urgent by itself. Immediate-request keywords such as “outage” do not require a separate action verb; a match is not proof that action is actually needed.

## Context that suppresses urgency

These apply only to the clause they appear in. Messages are split on sentence punctuation, line breaks, and "but".

- **Can wait**: `no rush`, `not urgent`, `not an emergency`, `when you have time`, `for your information`, `FYI only`, `no action/response/reply needed/required`
- **Resolved or canceled**: `is resolved`, `has been fixed`, `already canceled`, `interview canceled`
- **Postponed**: `deadline … extended`, `due date … postponed`

If the body contains resolved or can-wait context, the subject is not used as an urgent signal. This lets a body update supersede a stale "URGENT" subject, while a separate current request in the body can still trigger an alert.

Lines starting with `>` (quoted history) are ignored for urgency.

## User controls

- Each card supports a one-time move and saved sender rules (trusted, always urgent, subscription).
- Changing a saved rule re-sorts the visible inbox silently and replaces one-time moves.
- Contact rules are stored in the browser's local storage. Demo messages are not persisted.

## Audio behavior

- Low priority: a soft tone only.
- Urgent: a distinct tone followed by speech: "Urgent message. Please check."
- Alerts play one after another so speech is not interrupted. "Stop alerts" clears the queue, and changing an audio checkbox also stops pending alerts.
- Loading example sets is silent; use each card's Play button to hear its alert.
- Browser audio permissions, speech support, and background-tab restrictions still apply.

## Known gaps

Phrase matching is not semantic understanding. Complex negation, quoted history without `>`, conflicting clauses, absolute dates ("due Oct 3"), and unfamiliar phrasing can still be misclassified.

