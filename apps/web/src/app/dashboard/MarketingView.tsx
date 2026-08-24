import { Megaphone } from "lucide-react";

export function MarketingComingSoonBadge() {
  return <span className="marketing-coming-soon-badge">Coming soon</span>;
}

export function MarketingView() {
  return (
    <section className="marketing-coming-soon-page" aria-labelledby="marketing-coming-soon-title">
      <div>
        <span className="marketing-coming-soon-icon" aria-hidden="true"><Megaphone /></span>
        <MarketingComingSoonBadge />
        <h1 id="marketing-coming-soon-title">Marketing 360</h1>
        <p>Coming soon</p>
      </div>
    </section>
  );
}
