import {
  ArrowRightCircle, Building2, CalendarPlus, CarFront, CheckCircle2,
  CircleUserRound, FileText, Filter, LayoutDashboard, ListChecks, Link2, Plus, Search, ShieldCheck,
  SlidersHorizontal, ToggleLeft, Users, Wrench, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashView } from "../types";

export type WorkflowStep = { icon: LucideIcon; label: string };

// Short, concrete step sequences for the "See how this works" disclosure in the topbar help
// popover - only pages with an actual multi-step, multi-entity workflow get one; "coming soon"
// placeholders have nothing to diagram yet.
export const PAGE_WORKFLOW: Partial<Record<DashView, WorkflowStep[]>> = {
  analytics: [
    { icon: LayoutDashboard, label: "Check the four headline metrics" },
    { icon: ListChecks, label: "Open work flags what needs attention" },
    { icon: ArrowRightCircle, label: "Jump into the portal that owns it - Sales 360, Vehicle 360, a 360 record" },
    { icon: Building2, label: "Use the tabs for branch, group, and workforce analysis" },
  ],
  customers: [
    { icon: Search, label: "Search or add a customer" },
    { icon: CircleUserRound, label: "Open their record" },
    { icon: Zap, label: "Quick actions start work - opportunity, service, a call" },
    { icon: Link2, label: "Related sales, service, and communications attach automatically" },
  ],
  vehicles: [
    { icon: Search, label: "Search or add a vehicle by VIN or registration" },
    { icon: CarFront, label: "Open its record" },
    { icon: Wrench, label: "Quick actions update valuation or book a workshop visit" },
    { icon: Link2, label: "Ownership, lifecycle events, and work orders stay linked" },
  ],
  sales: [
    { icon: Plus, label: "Create a lead; select one to open its full record" },
    { icon: ArrowRightCircle, label: "Move it through stages as it progresses" },
    { icon: CalendarPlus, label: "Log a test drive from Quick actions" },
    { icon: CheckCircle2, label: "Once won, convert it to a sale - it appears in Finance 360" },
  ],
  service: [
    { icon: CalendarPlus, label: "Book a repair order; select one to open its full record" },
    { icon: ListChecks, label: "Move it through statuses as work progresses" },
    { icon: CircleUserRound, label: "The linked customer and vehicle are shown alongside the job" },
  ],
  parts: [
    { icon: Plus, label: "Add a part from the sidebar" },
    { icon: Filter, label: "Toggle low stock to see what needs reordering" },
    { icon: SlidersHorizontal, label: "Adjust quantity on hand with +/-" },
  ],
  finance: [
    { icon: Search, label: "Search or create a deal; select one to open its full record" },
    { icon: FileText, label: "Attach a finance contract from Quick actions" },
    { icon: ShieldCheck, label: "Attach one or more insurance policies for that customer and vehicle" },
    { icon: Link2, label: "Deals arrive here automatically once a lead is won and converted" },
  ],
  company: [
    { icon: Building2, label: "Add a branch" },
    { icon: Users, label: "Add a team member and assign a role" },
    { icon: ToggleLeft, label: "Toggle status to deactivate without deleting history" },
  ],
};

export function WorkflowDiagram({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="workflow-diagram">
      {steps.map((step, index) => (
        <div className="workflow-diagram-step" key={step.label}>
          <div className="workflow-diagram-rail">
            <div className="workflow-diagram-node"><step.icon size={14} /></div>
            {index < steps.length - 1 && <span className="workflow-diagram-line" aria-hidden="true" />}
          </div>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
