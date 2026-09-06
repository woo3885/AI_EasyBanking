# User browser navigation and page-ready contract

The backend owns `browserBindingId`, current `pageIdentity`, and every destination page identity.
These identities are distinct from the backend Playwright page identity. The bridge token is returned
only in the initial ACK for in-memory use and must be sent in `X-DDD-Bridge-Token`; it is never placed
in a URL, event, or log.

`NAVIGATION_REQUIRED` is published only to `/topic/sessions/{sessionId}/events`. Its payload contains
the binding ID, navigation ID, source and destination page identities, allowlisted relative route,
route revision, `SPA_PUSH` or `SPA_REPLACE`, expiry, and safe guidance. The only allowed routes are
`/deposit/products` and `/transfer/accounts`; absolute/protocol-relative URLs, query, fragment,
traversal, backslashes, and sensitive terms are rejected.

After rendering, the browser calls:

`POST /api/v1/sessions/{sessionId}/browser-bindings/page-ready`

with `Origin`, `X-DDD-Bridge-Token`, `X-DDD-Browser-Binding-Id`, and
`X-DDD-Page-Identity` (the source identity). The JSON body is `BrowserPageReadyRequest` and contains
only navigation identities, route revision/rendered route, and viewport metadata. Successful HTTP
`PAGE_READY_ACCEPTED` is authoritative; clients do not need to wait for the advisory
`PAGE_READY_OBSERVED` event. A successful request atomically rotates the current user page identity,
consumes the pending navigation, publishes the event, and invokes the next-step port once. A pending
navigation blocks overlay target creation. Replacement, cancellation, and expiry publish
`NAVIGATION_CLEAR`.
