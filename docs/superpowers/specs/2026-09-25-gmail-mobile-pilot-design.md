# Signal Gmail mobile pilot — design for review

Status: proposed design, not an implemented or connected product.

## Goal and scope

Build a small, consent-based Gmail pilot for both Android and iPhone. Busy students and professionals see two categories: Urgent / Job and Low Priority / Subscription. Low priority plays a soft tone only. Urgent plays a distinct tone followed by “Urgent message. Please check.” The critical acceptance test is the correct alert on an actual locked phone.

Support one Gmail account per user. Preserve the existing static Site, its project ID, its sample-message flow, and the 46-case regression set. Do not add SMS, modify Gmail labels, send email, or open public sign-ups in this pilot. The previous demo-only decision remains true for the current Site; real access belongs to the new mobile pilot after explicit account connection.

## Proposed architecture

Use React Native with Expo development builds for a shared mobile interface, with platform-specific notification configuration. A separate native Swift/Kotlin pair would provide more platform-specific control but require two implementations; a web-only app would not validate the native alert behavior this pilot is intended to test. The shared app is the proposed default.

Use a TypeScript backend on Firebase/Google Cloud, with Firestore for account-scoped rules and processing state, Pub/Sub for Gmail changes, scheduled jobs for recovery, and a durable notification outbox. This is a proposed hosting choice, not authorization to provision billable services. Keep the backend separate from the static Site.

Suggested repository boundaries:

- `apps/mobile`: sign-in, two inbox categories, explanations, correction controls, sound previews, pause/working hours, disconnect/delete.
- `services/mail`: Gmail authorization, change ingestion, classification, rules, outbox, and push delivery.
- `packages/classifier`: pure versioned classification logic and fixtures, shared with a generated browser-compatible copy used by the Site.
- `dist`: existing static Site remains the publishable output; preserve `.openai/hosting.json`.

First prove the two sounds with synthetic remote pushes on both platforms. Then connect Gmail. A local/browser simulation is not evidence that locked-phone alerts work.

## Account connection and mail processing

Google sign-in establishes account identity; Gmail authorization is a separate, explicit permission step. Request Gmail read-only access, not mail modification. Use a server-side authorization-code flow with state validation and supported PKCE protections. Refresh tokens stay encrypted on the backend; the app stores only its own revocable session in platform secure storage. Never put OAuth secrets in the Site or mobile bundle. Follow Google's [web-server OAuth guidance](https://developers.google.com/identity/protocols/oauth2/web-server).

Connection establishes a mailbox history cursor. Existing mail may populate the inbox silently; it must not produce a backlog of voice alerts. Process new inbox messages after the connection baseline. Gmail change events notify the backend, which reads mailbox history and fetches the relevant messages. Renew watches daily, retain their expiration, and recover gaps by synchronizing history. Gmail documents expiration, delayed/dropped events, and retry behavior in its [push guide](https://developers.google.com/workspace/gmail/api/guides/push).

Verify Pub/Sub deliveries using the configured authenticated endpoint. Deduplicate classification by account plus Gmail message ID; re-delivered history events and label changes must not produce new alerts for the same message. Advance the history cursor only after durable message decisions and outbox entries exist. An expired cursor triggers bounded resynchronization, with previously seen messages excluded from new alerts. Revoked credentials mark the account disconnected and stop retries until reconnection.

## Classification and scam-related boundaries

Retain exact sender matching, context-aware urgency, explanations, and editable trusted contacts. A displayed sender address alone is not proof of identity. The real-mail adapter must distinguish provider-observed authentication evidence from untrusted message text or attacker-supplied headers; unknown or failed evidence must not be presented as verified. Sender-authentication handling needs a dedicated implementation and adversarial test review before live automatic voice alerts are enabled.

Separate explicit subscription preferences and actual list/newsletter evidence from a lone unsubscribe phrase in a footer. Genuine subscriptions remain low priority, even for an always-urgent contact. A footer alone must not automatically suppress an otherwise urgent personal/work message. Add representative, consented examples for this distinction before changing the current heuristic; update the benchmark and document the intended rule precedence.

One-time moves affect that message. Saved sender corrections affect future decisions and persist per account. Store the classifier and preference versions with each decision. The Site remains a synthetic rule playground; initially transfer rules through explicit import/export, with the app validating and saving imported settings. Do not expose real mail or account tokens in the public Site.

## Phone alerts

Bundle two short WAV clips: a soft tone, and one combined urgent tone plus spoken phrase. Use notification sounds rather than assuming background JavaScript can run text-to-speech. Expo supports bundled sounds and requires native configuration/development builds for this flow; see [notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) and [custom sounds](https://docs.expo.dev/versions/latest/sdk/notifications/#set-custom-notification-sounds).

Android uses separate stable channels. Low Priority / Subscription must use a sound-enabled channel despite the category name: Android's low notification importance is normally silent. Users control channel behavior after creation. See [Android channels](https://developer.android.com/develop/ui/compose/notifications/channels). iOS selects the bundled clip in the notification payload; see [Apple payload keys](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/PayloadKeyReference.html).

Use Expo's push service initially, with generic category text and an opaque event ID only. No sender, subject, or message body goes into the lock-screen payload. Fetch details through the authenticated app. Track provider acceptance and errors separately from device receipt; neither proves the user heard the sound. Disable invalid device tokens.

Use a durable outbox keyed by account/message/device and bounded retries. Remote delivery cannot promise exactly-once audible playback or strict sound serialization across operating systems. Apply a per-device burst window to reduce overlapping alerts and test the actual result; do not claim the browser audio queue solves native delivery. Working hours and pause suppress sound without losing inbox entries. Do not replay all suppressed alerts when the pause ends. Focus, silent mode, denied permissions, and device settings remain authoritative.

Offer instructions for the user to turn off Gmail's own notifications if they want to avoid duplicate alerts; Signal does not silently change another app's settings.

## Data, privacy, and deletion

Persist rules, encrypted grants, history cursors, message IDs, category/reason, version IDs, delivery timestamps, and user corrections. Do not persist full bodies or attachments in the pilot. Fetch content only as needed for classification/display; omit it from logs and analytics. Use retention limits for message metadata and diagnostic events, with deletion tests.

Disconnect stops watches, disables queued delivery, revokes/deletes credentials, and removes device registrations for that account. Account deletion additionally removes saved rules and retained metadata. Enforce account ownership on every API and data access. An already delivered operating-system notification cannot be recalled reliably by disconnecting.

Google classifies Gmail read access as restricted and documents verification/security-assessment requirements. An invite-only pilot is not a blanket exemption; establish the applicable requirements before processing testers' mail. See [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).

## Acceptance gates

1. Physical Android and iPhone: permission grant/denial, both sound previews, locked-screen and background remote alerts, foreground behavior, and a burst of mixed categories. Record OS/device/settings and whether the expected audio was actually heard.
2. Gmail: connect, silent initial sync, one new urgent and one low-priority message, rule correction, rule persistence on another device, duplicate/reordered events, watch renewal, expired cursor recovery, revoked access, and delayed push.
3. Privacy: no mail content in push payloads/logs, cross-account access denied, disconnect suppresses pending alerts, deletion removes retained user data.
4. One-to-two-week pilot: report user-reviewed missed urgent messages and unnecessary voice alerts separately. Measure message-to-decision and decision-to-provider acceptance delays; report device-receipt delay only when observable. Do not infer audible-delivery latency from server receipts. Keep the synthetic benchmark separate from real-mail evaluation.

## Dependencies before device/live testing

The user needs access to a Google Cloud/Firebase project with required APIs and OAuth configuration, an Expo/EAS project or equivalent native build pipeline, Android push credentials, and Apple signing/push credentials. Expo's documented iOS setup requires an Apple Developer account. Use secure setup flows, not credentials pasted into chat or committed to Git. Actual Android and iPhone testers are required for the acceptance gates.

The current Sites connection cannot access the existing hosted project. This does not prevent mobile development, but publishing updates to that Site still requires restoring access to its owning account/workspace. No cloud resources, mail connection, or app-store distribution are created by this design document.

Review this design before preparing the implementation plan. Then implement in phases: device-audio proof, Gmail ingestion/classification, account controls/rule transfer, and measured pilot readiness.
