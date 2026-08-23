import { ArrowLeft, Sparkles } from "lucide-react";
import type { DashView } from "../types";

type ComingSoonProps = {
  title: string;
  description: string;
  planned: string[];
  onNavigate: (view: DashView) => void;
};

export function ComingSoon({ title, description, planned, onNavigate }: ComingSoonProps) {
  return (
    <div className="coming-soon-page">
      <span className="coming-soon-badge"><Sparkles size={14} /> Coming soon</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="coming-soon-planned">
        <span>Planned for this workspace</span>
        <ul>{planned.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <button type="button" className="workspace-button" onClick={() => onNavigate("overview")}>
        <ArrowLeft size={15} /> Back to executive pulse
      </button>
    </div>
  );
}
