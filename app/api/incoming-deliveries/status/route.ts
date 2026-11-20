// All delivery status changes require a note, a verified session, and an
// append-only action/audit entry. Legacy callers are validated by this route too.
export { POST } from "../actions/route";
