import { AlertCircle, Building2, Users } from "lucide-react";
import { FormEvent, RefObject, useEffect, useRef, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import type { Branch, Role, UserAccount } from "../types";
import { WorkspacePage } from "./RecordViews";
import { useContextualActions } from "./SidebarActions";

const ROLES: Role[] = ["admin", "branch_manager", "sales", "service", "staff"];
const ROLE_LABELS: Record<Role, string> = { admin: "Admin", branch_manager: "Branch manager", sales: "Sales", service: "Service", staff: "Staff" };

export function CompanyAdmin() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState("");

  const [branchForm, setBranchForm] = useState({ code: "", name: "", city: "" });
  const [branchSaving, setBranchSaving] = useState(false);

  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "staff" as Role, branchId: "" });
  const [userSaving, setUserSaving] = useState(false);

  const branchCodeRef = useRef<HTMLInputElement>(null);
  const userNameRef = useRef<HTMLInputElement>(null);

  function focusField(ref: RefObject<HTMLInputElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus();
  }

  useContextualActions(() => [
    { id: "add-branch", label: "Add branch", icon: Building2, onClick: () => focusField(branchCodeRef) },
    { id: "add-user", label: "Add team member", icon: Users, onClick: () => focusField(userNameRef) },
  ], []);

  function reload() {
    Promise.all([apiGet<{ branches: Branch[] }>("/api/v1/branches"), apiGet<{ users: UserAccount[] }>("/api/v1/users")])
      .then(([branchResult, userResult]) => { setBranches(branchResult.branches); setUsers(userResult.users); })
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : "Could not load company data."));
  }

  useEffect(() => { reload(); }, []);

  async function createBranch(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBranchSaving(true);
    try {
      await apiPost("/api/v1/branches", branchForm);
      setBranchForm({ code: "", name: "", city: "" });
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create the branch.");
    } finally {
      setBranchSaving(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setUserSaving(true);
    try {
      await apiPost("/api/v1/users", { ...userForm, branchId: userForm.branchId || null });
      setUserForm({ name: "", email: "", password: "", role: "staff", branchId: "" });
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create the user.");
    } finally {
      setUserSaving(false);
    }
  }

  async function toggleActive(user: UserAccount) {
    setError("");
    try {
      await apiPatch(`/api/v1/users/${user.id}`, { isActive: !user.isActive });
      reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update the user.");
    }
  }

  return (
    <WorkspacePage>
      <div className="admin-panel">
        {error && <p className="inline-error"><AlertCircle size={14} />{error}</p>}

        <div className="admin-table-card">
          <header><div><Building2 size={16} /><strong> Branches</strong></div><span>{branches?.length ?? 0} branches</span></header>
          <table className="admin-table">
            <thead><tr><th>Code</th><th>Name</th><th>City</th></tr></thead>
            <tbody>
              {branches?.map((branch) => <tr key={branch.id}><td>{branch.code}</td><td>{branch.name}</td><td>{branch.city ?? "-"}</td></tr>)}
              {branches && branches.length === 0 && <tr><td colSpan={3}>No branches yet.</td></tr>}
            </tbody>
          </table>
          <form className="admin-inline-form" onSubmit={createBranch}>
            <input ref={branchCodeRef} required placeholder="Code (e.g. SYD)" value={branchForm.code} onChange={(event) => setBranchForm({ ...branchForm, code: event.target.value.toUpperCase() })} maxLength={12} />
            <input required placeholder="Branch name" value={branchForm.name} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} />
            <input placeholder="City" value={branchForm.city} onChange={(event) => setBranchForm({ ...branchForm, city: event.target.value })} />
            <button type="submit" disabled={branchSaving}>{branchSaving ? "Adding..." : "Add branch"}</button>
          </form>
        </div>

        <div className="admin-table-card">
          <header><div><Users size={16} /><strong> Team accounts</strong></div><span>{users?.length ?? 0} accounts</span></header>
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th></tr></thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td><span className="role-badge">{ROLE_LABELS[user.role]}</span></td>
                  <td>{user.branchName ?? "All branches"}</td>
                  <td><button type="button" className="role-badge" onClick={() => toggleActive(user)}>{user.isActive ? "Active" : "Disabled"}</button></td>
                </tr>
              ))}
              {users && users.length === 0 && <tr><td colSpan={5}>No team accounts yet.</td></tr>}
            </tbody>
          </table>
          <form className="admin-inline-form" onSubmit={createUser}>
            <input ref={userNameRef} required placeholder="Full name" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
            <input required type="email" placeholder="Work email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
            <input required type="password" placeholder="Temporary password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} minLength={8} />
            <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}>
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
            <select value={userForm.branchId} onChange={(event) => setUserForm({ ...userForm, branchId: event.target.value })}>
              <option value="">All branches</option>
              {branches?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <button type="submit" disabled={userSaving}>{userSaving ? "Adding..." : "Add team member"}</button>
          </form>
        </div>
      </div>
    </WorkspacePage>
  );
}
