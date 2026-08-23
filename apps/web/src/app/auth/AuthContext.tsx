import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiGet, apiPost, getStoredToken, registerUnauthorizedHandler, setStoredToken } from "../../lib/api";
import type { Organization, Role, SessionUser } from "../types";

type MePayload = { user: SessionUser; organization: Organization | null };
type AuthPayload = { token: string; user: SessionUser; organization: Organization | null };

export type SignupInput = {
  organizationName: string;
  branchName: string;
  branchCity: string;
  branchCode: string;
  adminName: string;
  adminEmail: string;
  password: string;
};

type AuthContextValue = {
  status: "loading" | "authenticated" | "anonymous";
  user: SessionUser | null;
  organization: Organization | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authenticated" | "anonymous">("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setOrganization(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(logout);
    return () => registerUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setStatus("anonymous");
      return;
    }
    apiGet<MePayload>("/api/v1/auth/me")
      .then((payload) => {
        setUser(payload.user);
        setOrganization(payload.organization);
        setStatus("authenticated");
      })
      .catch(() => {
        setStoredToken(null);
        setStatus("anonymous");
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const payload = await apiPost<AuthPayload>("/api/v1/auth/login", { email, password });
    setStoredToken(payload.token);
    setUser(payload.user);
    setOrganization(payload.organization);
    setStatus("authenticated");
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const payload = await apiPost<AuthPayload>("/api/v1/auth/signup", input);
    setStoredToken(payload.token);
    setUser(payload.user);
    setOrganization(payload.organization);
    setStatus("authenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, organization, login, signup, logout }),
    [status, user, organization, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider.");
  return context;
}

export function roleLabel(role: Role): string {
  return {
    admin: "Company admin",
    general_manager: "General manager",
    sales_manager: "Sales manager",
    bdc_rep: "BDC representative",
    finance_manager: "Finance manager",
    service_advisor: "Service advisor",
    receptionist: "Receptionist",
  }[role];
}

export { ApiError };
