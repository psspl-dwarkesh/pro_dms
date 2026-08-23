import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";
import { Brand } from "../components/Brand";
import { useAuth } from "./AuthContext";

type LoginPageProps = { onSuccess: () => void; onBackToSite: () => void; onGoToSignup: () => void };

export default function LoginPage({ onSuccess, onBackToSite, onGoToSignup }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
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
      </div>
    </div>
  );
}
