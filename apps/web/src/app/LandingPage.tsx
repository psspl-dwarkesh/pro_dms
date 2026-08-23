import {
  ArrowRight, BadgeCheck, BarChart3, CarFront, ChevronRight, CircleUserRound,
  Gauge, Mail, Menu, MessageCircle, Network, Phone, Search, ShieldCheck, Sparkles,
  Wrench, X,
} from "lucide-react";
import { useState } from "react";
import { PUBLIC_DOMAINS } from "./data";
import { Brand, IconFrame } from "./components/Brand";
import type { DashView } from "./types";

type LandingPageProps = { onOpenWorkspace: (view?: DashView) => void; onGoToLogin: () => void; onGoToSignup: () => void };
type PreviewMode = "pulse" | "customer" | "vehicle" | "service";

const previewModes: Array<{ id: PreviewMode; label: string; icon: typeof Gauge; view: DashView }> = [
  { id: "pulse", label: "Executive", icon: Gauge, view: "overview" },
  { id: "customer", label: "Customer 360", icon: CircleUserRound, view: "customers" },
  { id: "vehicle", label: "Vehicle 360", icon: CarFront, view: "vehicles" },
  { id: "service", label: "Service-to-trade", icon: Wrench, view: "service" },
];

const axisDomains: Array<{ label: string; view: DashView; detail: string }> = [
  { label: "Sales", view: "sales", detail: "Enquiry → delivery" },
  { label: "Service", view: "service", detail: "Booking → handover" },
  { label: "Parts", view: "parts", detail: "VIN fit → issue" },
  { label: "F&I", view: "finance", detail: "KYC → settlement" },
  { label: "Inventory", view: "inventory", detail: "Order → allocation" },
  { label: "Used", view: "usedcars", detail: "Appraise → publish" },
];

const operatingSteps = [
  { label: "Acquire", detail: "Enquiry, prospect, trade-in", icon: CircleUserRound },
  { label: "Transact", detail: "Quote, F&I, order, delivery", icon: CarFront },
  { label: "Retain", detail: "Service, parts, warranty, journeys", icon: Wrench },
  { label: "Optimise", detail: "Margin, capacity, risk, forecast", icon: BarChart3 },
];

function ProductPreview({ onOpenWorkspace }: Pick<LandingPageProps, "onOpenWorkspace">) {
  const [mode, setMode] = useState<PreviewMode>("pulse");
  const active = previewModes.find((item) => item.id === mode)!;
  return (
    <div className="product-preview product-preview--interactive" aria-label="Interactive AutoAxis workspace preview">
      <div className="preview-topbar">
        <span>Pacific Motor Group <b>Live operations</b></span>
        <span className="preview-live"><i /> Neon connected</span>
      </div>
      <div className="preview-layout">
        <aside className="preview-rail">
          <Brand inverse compact />
          <div className="preview-rail-buttons">
            {previewModes.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" aria-label={label} title={label} className={mode === id ? "active" : ""} onClick={() => setMode(id)}><Icon size={15} /></button>
            ))}
          </div>
        </aside>
        <div className="preview-canvas">
          <div className="preview-heading">
            <div><span>{active.label}</span><strong>{mode === "pulse" ? "Good afternoon, Olivia." : mode === "customer" ? "James Hartley" : mode === "vehicle" ? "2022 BMW X5" : "RO-18506 · upgrade signal"}</strong></div>
            <button type="button" onClick={() => onOpenWorkspace(active.view)}>Open full workspace <ArrowRight size={14} /></button>
          </div>
          {mode === "pulse" && <PreviewPulse />}
          {mode === "customer" && <PreviewCustomer />}
          {mode === "vehicle" && <PreviewVehicle />}
          {mode === "service" && <PreviewService />}
          <div className="preview-switcher" aria-label="Preview scenarios">
            {previewModes.map((item) => <button type="button" key={item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)}>{item.label}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewPulse() {
  return <><div className="preview-kpis"><div><span>Revenue to plan</span><strong>104.8%</strong><em>+$284k</em></div><div><span>Gross margin</span><strong>18.6%</strong><em>+0.8 pts</em></div><div><span>Workshop load</span><strong>86%</strong><em>12 live ROs</em></div></div><div className="preview-grid"><div className="preview-chart-card"><div className="preview-card-label"><span>Group operating flow</span><b>Today</b></div><svg viewBox="0 0 440 150" role="img" aria-label="Illustrative revenue trend"><defs><linearGradient id="previewArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1463ff" stopOpacity=".28" /><stop offset="1" stopColor="#1463ff" stopOpacity="0" /></linearGradient></defs><path d="M0 120 C35 105,55 112,82 88 S130 63,162 76 S220 102,252 67 S302 39,338 55 S390 62,440 22 L440 150 L0 150Z" fill="url(#previewArea)" /><path d="M0 120 C35 105,55 112,82 88 S130 63,162 76 S220 102,252 67 S302 39,338 55 S390 62,440 22" fill="none" stroke="#1463ff" strokeWidth="3" /></svg></div><div className="preview-exceptions"><div className="preview-card-label"><span>Needs action</span><b>4 critical</b></div><div><i className="bad" /><p><strong>RO-18492</strong><span>Diagnostic blocked</span></p><em>52m</em></div><div><i className="warn" /><p><strong>7 deliveries</strong><span>Promise risk</span></p><em>Today</em></div><div><i className="good" /><p><strong>Finance</strong><span>Best in group</span></p><em>48.2%</em></div></div></div></>;
}

function PreviewCustomer() {
  return <div className="mini-record"><div className="mini-record-hero"><span>JH</span><div><small>Individual · customer since 2019</small><strong>James Hartley</strong><p>04•• ••• 214 · Email preferred</p></div><b>Connected record</b></div><div className="mini-record-stats"><div><small>Lifetime value</small><strong>$42,860</strong></div><div><small>Vehicles</small><strong>2</strong></div><div><small>Service visits</small><strong>9</strong></div></div><div className="mini-journey"><i className="done" /><span>Service completed</span><i className="active" /><span>Positive equity detected</span><i /><span>Ownership review</span></div></div>;
}

function PreviewVehicle() {
  return <div className="mini-record"><div className="mini-record-hero"><span><CarFront /></span><div><small>VIN WBA•••981 · NSW DMS-360</small><strong>2022 BMW X5 xDrive40i</strong><p>48,620 km · Warranty active</p></div><b>Retail owned</b></div><div className="mini-record-stats"><div><small>Market value</small><strong>$84,500</strong></div><div><small>Trade estimate</small><strong>$78,200</strong></div><div><small>Health</small><strong>92 / 100</strong></div></div><div className="mini-journey"><i className="done" /><span>Owner verified</span><i className="done" /><span>Service complete</span><i className="active" /><span>Appraise</span></div></div>;
}

function PreviewService() {
  return <div className="mini-service"><div><small>Connected opportunity</small><strong>Service-to-trade</strong><p>James' X5 is in Bay 06. Positive equity and 48-month ownership make this a qualified appraisal moment.</p></div><ol><li className="done"><i />RO checked in <b>08:10</b></li><li className="done"><i />Inspection complete <b>09:05</b></li><li className="active"><i />Trade appraisal <b>Now</b></li><li><i />Sales follow-up <b>Queued</b></li></ol></div>;
}

export default function LandingPage({ onOpenWorkspace, onGoToLogin, onGoToSignup }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [axisIndex, setAxisIndex] = useState(0);
  const axis = axisDomains[axisIndex];
  return (
    <div className="marketing-site">
      <header className="marketing-header marketing-header--dark">
        <div className="site-shell header-inner">
          <a href="#top" aria-label="AutoAxis home"><Brand inverse /></a>
          <nav className="desktop-nav" aria-label="Primary navigation"><a href="#platform">Platform</a><a href="#journey">Connected journey</a><a href="#roles">Workspaces</a><a href="#trust">Trust</a><button type="button" onClick={onGoToLogin}>Sign in</button></nav>
          <button className="button button--header desktop-cta" type="button" onClick={onGoToSignup}>Sign up your company <ArrowRight size={16} /></button>
          <button className="mobile-menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
        {menuOpen && <nav className="mobile-nav mobile-nav--dark" aria-label="Mobile navigation"><a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a><a href="#journey" onClick={() => setMenuOpen(false)}>Connected journey</a><a href="#roles" onClick={() => setMenuOpen(false)}>Workspaces</a><button className="button button--light" type="button" onClick={onGoToLogin}>Sign in</button><button className="button button--signal" type="button" onClick={onGoToSignup}>Sign up your company</button></nav>}
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-noise" />
          <div className="site-shell hero-grid">
            <div className="hero-copy">
              <p className="eyebrow"><span /> Automotive Integration Hub</p>
              <h1>One operating system for the <em>whole dealership.</em></h1>
              <p className="hero-lede">AutoAxis connects every customer, vehicle, team and transaction around two trusted records, so work flows from enquiry to ownership without losing context.</p>
              <div className="hero-actions"><button className="button button--signal" type="button" onClick={() => onOpenWorkspace("customers")}>Search a customer <ArrowRight size={17} /></button><a className="text-link" href="#journey">Follow the connected journey <ChevronRight size={16} /></a></div>
              <div className="hero-proof"><div><strong>360°</strong><span>customer + vehicle context</span></div><div><strong>13</strong><span>role-based workspaces</span></div><div><strong>1</strong><span>real-time operating layer</span></div></div>
            </div>
            <ProductPreview onOpenWorkspace={onOpenWorkspace} />
          </div>
          <div className="site-shell integration-strip"><span>Example connectors · integration-ready</span><div>{["OEM APIs", "WhatsApp Business", "Twilio", "DocuSign", "Cox Automotive", "Xero"].map((label) => <b key={label} title={`${label} · example connector`}>{label}</b>)}</div></div>
        </section>

        <section className="operating-model" id="platform">
          <div className="site-shell">
            <div className="section-intro section-intro--split"><div><p className="eyebrow eyebrow--dark"><span /> One operational truth</p><h2>The record moves with the work.</h2></div><p>Phone search finds the relationship. VIN search finds the asset. Every department adds to the same story instead of creating another disconnected version.</p></div>
            <div className="axis-board">
              <div className="axis-board-copy"><span className="board-kicker">Interactive operating model</span><h3>{axis.label} is connected by design.</h3><p>{axis.detail}. Customer, vehicle, consent, value and responsibility stay visible through every handoff.</p><div className="axis-detail"><span>Selected workspace</span><strong>{axis.label}</strong><em>{axis.detail}</em></div><button type="button" className="text-link text-link--light" onClick={() => onOpenWorkspace(axis.view)}>Open {axis.label} workspace <ArrowRight size={16} /></button></div>
              <div className="axis-map" aria-label="Interactive connected DMS domain map">
                <div className="axis-orbit axis-orbit--outer" /><div className="axis-orbit axis-orbit--inner" /><div className="axis-path" />
                {axisDomains.map((domain, index) => <button key={domain.label} type="button" className={`axis-node axis-node--${index + 1} ${axisIndex === index ? "active" : ""}`} onClick={() => setAxisIndex(index)}><span>{domain.label}</span><small>{domain.detail}</small></button>)}
                <button type="button" className="axis-core" onClick={() => onOpenWorkspace(axisIndex % 2 ? "vehicles" : "customers")}><Network size={24} /><strong>Customer 360</strong><span>Vehicle 360</span><small>Open master record</small></button>
              </div>
            </div>
          </div>
        </section>

        <section className="connected-journey" id="journey">
          <div className="site-shell">
            <div className="section-intro"><p className="eyebrow eyebrow--dark"><span /> Killer demonstration</p><h2>One service visit. Six connected decisions.</h2><p>Open a customer, inspect the vehicle, find a value signal and carry it into a controlled used-vehicle workflow.</p></div>
            <div className="journey-track">{["Search mobile", "Open owned VIN", "Service inspection", "Trade appraisal", "Acquire + recondition", "Publish + follow up"].map((label, index) => <button type="button" key={label} onClick={() => onOpenWorkspace(index === 0 ? "customers" : index < 3 ? "vehicles" : index === 3 ? "usedcars" : "sales")}><span>0{index + 1}</span><strong>{label}</strong><ArrowRight /></button>)}</div>
            <div className="channel-rail"><span>Act from the record</span><b><Phone /> Call</b><b><MessageCircle /> WhatsApp</b><b><Mail /> Email</b><b><Search /> Filter history</b><b><ArrowRight /> Share or export</b></div>
          </div>
        </section>

        <section className="domain-section" id="roles"><div className="site-shell"><div className="section-intro"><p className="eyebrow eyebrow--dark"><span /> Purpose-built workspaces</p><h2>One platform. Different decisions.</h2><p>Each role sees its own operating detail with the same customer and vehicle context underneath.</p></div><div className="domain-list">{PUBLIC_DOMAINS.map((domain) => <button key={domain.id} type="button" className="domain-row" onClick={() => onOpenWorkspace(domain.id)}><span className="domain-index">{domain.index}</span><strong>{domain.name}</strong><p>{domain.description}</p><span className="domain-arrow"><ArrowRight /></span></button>)}</div></div></section>

        <section className="workflow-section"><div className="site-shell workflow-grid"><div className="workflow-copy"><p className="eyebrow"><span /> A connected day</p><h2>From first signal to lifetime value.</h2><p>Every handoff retains the data, responsibility, customer promise and next action.</p><button className="button button--light" type="button" onClick={() => onOpenWorkspace("service")}>Explore service operations <ArrowRight size={16} /></button></div><ol className="workflow-steps">{operatingSteps.map(({ label, detail, icon: Icon }, index) => <li key={label}><IconFrame tone={index === 3 ? "teal" : "signal"}><Icon size={18} /></IconFrame><div><span>0{index + 1}</span><strong>{label}</strong><p>{detail}</p></div></li>)}</ol></div></section>

        <section className="trust-section" id="trust"><div className="site-shell trust-grid"><div className="trust-copy"><p className="eyebrow eyebrow--dark"><span /> Enterprise foundation</p><h2>Built for control, not just dashboards.</h2><p>The showcase uses clearly labelled demonstration workflows. Production connections add approved identity, tenant isolation, audit history and observed service levels.</p></div><div className="trust-cards"><div><ShieldCheck /><strong>Tenant-ready boundaries</strong><p>Organization and branch scope built into the data model.</p></div><div><BadgeCheck /><strong>Evidence discipline</strong><p>Illustrative outcomes remain separate from customer proof.</p></div><div><Sparkles /><strong>Release confidence</strong><p>Feature branches, database verification and staged promotion.</p></div></div></div></section>

        <section className="closing-section"><div className="site-shell closing-inner"><div><span>See the operating model in motion.</span><h2>Walk from one mobile number to one VIN, and every decision between.</h2></div><button className="button button--signal" type="button" onClick={() => onOpenWorkspace("customers")}>Launch the demonstration <ArrowRight size={17} /></button></div></section>
      </main>

      <footer className="marketing-footer"><div className="site-shell footer-grid"><div><Brand inverse /><p>Connected operating software for modern automotive retail.</p><a className="builder-lockup" href="https://prakashinfotech.com" target="_blank" rel="noreferrer"><span>Designed &amp; built by</span><strong>Prakash Infotech</strong></a></div><div><span>Platform</span><a href="#platform">Operating model</a><a href="#journey">Connected journey</a><a href="#roles">Workspaces</a></div><div><span>Product</span><button type="button" onClick={() => onOpenWorkspace("customers")}>Customer 360</button><button type="button" onClick={() => onOpenWorkspace("vehicles")}>Vehicle 360</button><button type="button" onClick={() => onOpenWorkspace("group")}>Group analytics</button></div><div><span>Contact</span><a href="mailto:dms@prakashinfotech.com">dms@prakashinfotech.com</a><a href="https://prakashinfotech.com" target="_blank" rel="noreferrer">prakashinfotech.com</a><a href="#trust">Trust &amp; delivery</a></div></div><div className="site-shell footer-bottom"><span>© 2026 AutoAxis · A Prakash Infotech product case study.</span><span>Operational data shown is illustrative.</span></div></footer>
    </div>
  );
}
