import { redirect } from "next/navigation";

// Retire the legacy Pricing Base editor. All manual and bulk pricing changes
// must use the audited /pricing workflow with a mandatory action note.
export default function PricingBasePage() {
  redirect("/pricing");
}
