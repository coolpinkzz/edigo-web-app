import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { inviteTeamMember, listTeamMembers, patchTeamMember } from "../api";
import { Button, Card, Input, SelectField } from "../components/ui";
import { teamMembersQueryKey } from "../constants/query-keys";
import type {
  InviteTeamMemberPayload,
  PatchTeamMemberPayload,
  TeamMemberDto,
  TeamMemberRole,
} from "../types";
import { getUserIdFromStorage } from "../utils/auth";
import { getErrorMessage } from "../utils";
import { cn } from "../utils/cn";

const ROLE_OPTIONS: { value: TeamMemberRole; label: string }[] = [
  { value: "TENANT_ADMIN", label: "Tenant admin" },
  { value: "STAFF", label: "Staff" },
  { value: "VIEWER", label: "Viewer" },
];

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * Tenant admins: list staff, invite users, change roles and active status.
 */
export function TeamManagementPage() {
  const queryClient = useQueryClient();
  const currentUserId = getUserIdFromStorage();
  const [inviteBanner, setInviteBanner] = useState<{
    phone: string;
    password: string;
  } | null>(null);

  const membersQuery = useQuery({
    queryKey: teamMembersQueryKey,
    queryFn: listTeamMembers,
  });

  const inviteForm = useForm<InviteTeamMemberPayload>({
    defaultValues: {
      phone: "",
      name: "",
      role: "STAFF",
    },
    mode: "onSubmit",
  });
  const inviteRole = inviteForm.watch("role");

  const inviteMutation = useMutation({
    mutationFn: inviteTeamMember,
    onSuccess: (data) => {
      setInviteBanner({ phone: data.phone, password: data.temporaryPassword });
      inviteForm.reset({ phone: "", name: "", role: "STAFF" });
      void queryClient.invalidateQueries({ queryKey: teamMembersQueryKey });
    },
  });

  const patchMutation = useMutation({
    mutationFn: (vars: { userId: string; body: PatchTeamMemberPayload }) =>
      patchTeamMember(vars.userId, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamMembersQueryKey });
    },
  });

  const members = membersQuery.data ?? [];
  const patchingFor = (id: string) =>
    patchMutation.isPending && patchMutation.variables?.userId === id;

  async function copyPassword(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <p className="text-sm text-muted-foreground">
        Invite staff and set roles for your organization. Share the temporary
        password with new users so they can sign in, then change it from account
        settings when available.
      </p>

      {inviteBanner && (
        <div
          className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground shadow-md shadow-black/[0.06]"
          role="status"
        >
          <p className="font-medium">User added</p>
          <p className="mt-1 text-muted-foreground">
            <span className="text-foreground">{inviteBanner.phone}</span> can
            log in with this one-time password:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-background/80 px-2 py-1 font-mono text-foreground">
              {inviteBanner.password}
            </code>
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => copyPassword(inviteBanner.password)}
            >
              Copy password
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => setInviteBanner(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Invite user
        </h2>
        <form
          className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={inviteForm.handleSubmit((values) =>
            inviteMutation.mutate({
              phone: values.phone.trim(),
              name: values.name.trim(),
              role: values.role,
            }),
          )}
        >
          <div className="min-w-[12rem] flex-1">
            <Input
              label="Phone number"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="9876543210"
              {...inviteForm.register("phone", {
                required: "Phone number is required",
                minLength: { value: 8, message: "Enter a valid phone number" },
              })}
              error={inviteForm.formState.errors.phone?.message}
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <Input
              label="Name"
              autoComplete="name"
              {...inviteForm.register("name", { required: "Name is required" })}
              error={inviteForm.formState.errors.name?.message}
            />
          </div>
          <div className="min-w-[11rem]">
            <SelectField
              label="Role"
              value={inviteRole}
              onValueChange={(v) =>
                inviteForm.setValue("role", v as TeamMemberRole, {
                  shouldDirty: true,
                })
              }
              options={ROLE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
          </div>
          <Button
            type="submit"
            disabled={inviteMutation.isPending}
            className="sm:mb-[2px]"
          >
            {inviteMutation.isPending ? "Inviting…" : "Send invite"}
          </Button>
        </form>
        {inviteMutation.isError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {getErrorMessage(inviteMutation.error)}
          </p>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Team members
        </h2>
        {membersQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {membersQuery.isError && (
          <p className="text-sm text-red-600" role="alert">
            {getErrorMessage(membersQuery.error)}
          </p>
        )}
        {membersQuery.isSuccess && members.length === 0 && (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        )}
        {members.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-card-border bg-card shadow-md shadow-black/[0.06]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-primary-gradient text-primary-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <TeamMemberRow
                    key={m.id}
                    member={m}
                    isSelf={m.id === currentUserId}
                    isPatching={patchingFor(m.id)}
                    onPatch={(body) =>
                      patchMutation.mutate({ userId: m.id, body })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {patchMutation.isError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {getErrorMessage(patchMutation.error)}
          </p>
        )}
      </div>
    </div>
  );
}

function TeamMemberRow({
  member,
  isSelf,
  isPatching,
  onPatch,
}: {
  member: TeamMemberDto;
  isSelf: boolean;
  isPatching: boolean;
  onPatch: (body: PatchTeamMemberPayload) => void;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        !member.isActive && "opacity-70",
      )}
    >
      <td className="px-4 py-3 font-medium text-foreground">
        {member.name}
        {isSelf && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (you)
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{member.phone}</td>
      <td className="px-4 py-3">
        <select
          className="w-full max-w-[11rem] rounded-lg border border-border bg-card px-2 py-1.5 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          value={member.role}
          disabled={isPatching}
          onChange={(e) => {
            const role = e.target.value as TeamMemberRole;
            if (role !== member.role) onPatch({ role });
          }}
          aria-label={`Role for ${member.name}`}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-4 rounded border-border bg-background accent-primary focus:ring-2 focus:ring-primary/30"
            checked={member.isActive}
            disabled={isPatching}
            onChange={(e) => {
              const isActive = e.target.checked;
              if (isActive !== member.isActive) onPatch({ isActive });
            }}
          />
          <span className="text-foreground">
            {member.isActive ? "Active" : "Inactive"}
          </span>
        </label>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {formatWhen(member.createdAt)}
      </td>
    </tr>
  );
}
