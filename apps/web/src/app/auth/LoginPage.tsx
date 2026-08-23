import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";
import { useAuth } from "./AuthContext";

type LoginPageProps = { onSuccess: () => void; onBackToSite: () => void; onGoToSignup: () => void };

// Dev-only convenience list of seeded accounts, for one-click sign-in while testing locally.
// import.meta.env.DEV means Vite strips this out of production builds entirely.
const QUICK_SIGN_IN_ACCOUNTS = [
  { email: "admin@prakashinfotech.com", password: "Demo@12345", label: "Admin", detail: "Pacific Motor Group" },
];

export default function LoginPage({ onSuccess, onBackToSite, onGoToSignup }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function performLogin(loginEmail: string, loginPassword: string) {
    setError("");
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await performLogin(email, password);
  }

  function handleQuickSignIn(account: (typeof QUICK_SIGN_IN_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(account.password);
    void performLogin(account.email, account.password);
  }

  return (
    <div className="auth-shell">
      <button type="button" className="auth-back" onClick={onBackToSite}><ArrowLeft size={15} /> Product site</button>
      <div className="auth-card">
        <Brand />
        <h1>Sign in to your workspace</h1>
        <p className="auth-subtitle">Use your company email to access Customer 360, Vehicle 360, and your connected operations.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label><span>Work email</span><input type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@yourcompany.com" /></label>
          <label><span>Password</span><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
          {error && <p className="auth-error"><AlertCircle size={15} />{error}</p>}
          <button type="submit" className="workspace-button workspace-button--dark auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"} <ArrowRight size={15} />
          </button>
        </form>
        <p className="auth-switch">New dealership company? <button type="button" onClick={onGoToSignup}>Create a workspace</button></p>
        {import.meta.env.DEV && (
          <div className="auth-quick-signin">
            <span>Quick sign-in (dev only, removed from production builds)</span>
            {QUICK_SIGN_IN_ACCOUNTS.map((account) => (
              <button type="button" key={account.email} disabled={loading} onClick={() => handleQuickSignIn(account)}>
                <strong>{account.label}</strong><small>{account.email} · {account.detail}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
