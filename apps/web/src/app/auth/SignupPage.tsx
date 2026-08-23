import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";
import { useAuth } from "./AuthContext";

type SignupPageProps = { onSuccess: () => void; onBackToSite: () => void; onGoToLogin: () => void };

export default function SignupPage({ onSuccess, onBackToSite, onGoToLogin }: SignupPageProps) {
  const { signup } = useAuth();
  const [form, setForm] = useState({
    organizationName: "",
    branchName: "Main branch",
    branchCity: "",
    branchCode: "HQ",
    adminName: "",
    adminEmail: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await signup(form);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the workspace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <button type="button" className="auth-back" onClick={onBackToSite}><ArrowLeft size={15} /> Product site</button>
      <div className="auth-card auth-card--wide">
        <Brand />
        <h1>Create your dealership workspace</h1>
        <p className="auth-subtitle">Set up your company, its first branch, and your admin account. Every dealership company gets its own isolated workspace.</p>
        <form onSubmit={handleSubmit} className="auth-form auth-form--grid">
          <label><span>Company name</span><input required value={form.organizationName} onChange={(event) => update("organizationName", event.target.value)} placeholder="Pacific Motor Group" /></label>
          <label><span>First branch name</span><input required value={form.branchName} onChange={(event) => update("branchName", event.target.value)} placeholder="Sydney Central" /></label>
          <label><span>Branch city</span><input value={form.branchCity} onChange={(event) => update("branchCity", event.target.value)} placeholder="Sydney" /></label>
          <label><span>Branch code</span><input required value={form.branchCode} onChange={(event) => update("branchCode", event.target.value.toUpperCase())} placeholder="SYD" maxLength={12} /></label>
          <label><span>Your name</span><input required value={form.adminName} onChange={(event) => update("adminName", event.target.value)} placeholder="Your full name" /></label>
          <label><span>Work email</span><input type="email" required value={form.adminEmail} onChange={(event) => update("adminEmail", event.target.value)} placeholder="you@yourcompany.com" /></label>
          <label className="auth-form-full"><span>Password</span><input type="password" required value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" /></label>
          {error && <p className="auth-error auth-form-full"><AlertCircle size={15} />{error}</p>}
          <button type="submit" className="workspace-button workspace-button--dark auth-submit auth-form-full" disabled={loading}>
            {loading ? "Creating workspace…" : "Create workspace"} <ArrowRight size={15} />
          </button>
        </form>
        <p className="auth-switch">Already have a workspace? <button type="button" onClick={onGoToLogin}>Sign in</button></p>
      </div>
    </div>
  );
}
