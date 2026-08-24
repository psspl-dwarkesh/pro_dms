import { ArrowLeft, Sparkles } from "lucide-react";
import type { DashView } from "../types";

type ComingSoonProps = {
  title: string;
  description: string;
  planned: string[];
  // Where "back" goes. A placeholder page inside a live portal returns to that portal's own core
  // page; a whole portal that is still a placeholder returns to the role's landing portal. There
  // is no cross-portal home screen to fall back on any more.
  backView: DashView;
  backLabel: string;
  onNavigate: (view: DashView) => void;
};

export function ComingSoon({ title, description, planned, backView, backLabel, onNavigate }: ComingSoonProps) {
  return (
    <div className="coming-soon-page">
      <span className="coming-soon-badge"><Sparkles size={14} /> Coming soon</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="coming-soon-planned">
        <span>Planned for this page</span>
        <ul>{planned.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <button type="button" className="workspace-button" onClick={() => onNavigate(backView)}>
        <ArrowLeft size={15} /> {backLabel}
      </button>
    </div>
  );
}
