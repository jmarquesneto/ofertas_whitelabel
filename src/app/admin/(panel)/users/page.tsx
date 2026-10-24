import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/PageHeader";
import { CreateUserForm, PermissionsMatrix, RoleSelect, UserActions } from "@/components/admin/UserForms";
import { cn, fmtDate } from "@/lib/utils";

export const metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePage("users");
  const [list, perms] = await Promise.all([
    db
      .select({
        id: users.id, name: users.name, email: users.email, role: users.role, isBlocked: users.isBlocked,
        totpEnabled: users.totpEnabled, mustChangePassword: users.mustChangePassword, lastLoginAt: users.lastLoginAt,
        codes: sql<number>`(select count(*) from backup_codes b where b.user_id = ${users.id} and b.used_at is null)`.mapWith(Number),
      })
      .from(users)
      .orderBy(asc(users.isBlocked), asc(users.name)),
    db.select().from(rolePermissions),
  ]);
  const granted: Record<string, string[]> = {};
  for (const p of perms) (granted[p.role] ??= []).push(p.page);

  return (
    <>
      <PageHeader title="Usuários" subtitle={`${list.filter((u) => !u.isBlocked).length} ativos · ${list.filter((u) => u.isBlocked).length} bloqueados`} />
      <div className="grid gap-5">
        <CreateUserForm />

        <section className="card overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-surface">
              <tr>
                <th className="table-head">Usuário</th>
                <th className="table-head">Grupo</th>
                <th className="table-head">Situação</th>
                <th className="table-head">Último acesso</th>
                <th className="table-head text-right">Manutenção</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className={cn("align-top", u.isBlocked && "bg-red-50/40")}>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold", u.isBlocked ? "bg-red-100 text-red-800" : "bg-primary/25")}>{u.name.charAt(0).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{u.name}{self && <span className="ml-1.5 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">você</span>}</p>
                          <p className="truncate text-xs text-ink-faint">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell"><RoleSelect id={u.id} role={u.role} disabled={self} /></td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {u.isBlocked ? <Badge c="red">Bloqueado</Badge> : <Badge c="green">Ativo</Badge>}
                        {!u.totpEnabled && <Badge c="amber">2FA pendente</Badge>}
                        {u.mustChangePassword && <Badge c="blue">Troca de senha pendente</Badge>}
                        {u.totpEnabled && u.codes === 0 && <Badge c="gray">Sem códigos de recuperação</Badge>}
                      </div>
                    </td>
                    <td className="table-cell whitespace-nowrap text-sm text-ink-muted">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Nunca"}</td>
                    <td className="table-cell">
                      {self ? (
                        <a href="/admin/perfil" className="float-right text-sm font-semibold text-ink-muted underline hover:text-ink">Editar em Meu perfil</a>
                      ) : (
                        <UserActions id={u.id} name={u.name} blocked={u.isBlocked} has2fa={u.totpEnabled} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <PermissionsMatrix granted={granted} />
      </div>
    </>
  );
}

function Badge({ c, children }: { c: "red" | "green" | "amber" | "blue" | "gray"; children: React.ReactNode }) {
  const cls = { red: "bg-red-50 text-red-800", green: "bg-green-50 text-green-800", amber: "bg-amber-50 text-amber-900", blue: "bg-blue-50 text-blue-800", gray: "bg-surface-sunken text-ink-muted" }[c];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>{children}</span>;
}
