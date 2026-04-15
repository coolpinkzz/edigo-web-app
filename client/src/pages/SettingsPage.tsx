import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { patchTenant } from "../api";
import { Button, Card, Input } from "../components/ui";
import { authMeQueryKey } from "../constants/query-keys";
import { useAuthSession } from "../hooks/useAuthSession";
import type { AuthMeResponse } from "../types";
import { getErrorMessage } from "../utils";

type FormValues = { name: string };

/**
 * Tenant admins: view and edit organization display name.
 */
export function SettingsPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useAuthSession();
  const form = useForm<FormValues>({ defaultValues: { name: "" } });

  useEffect(() => {
    const name = sessionQuery.data?.tenant?.name;
    if (name !== undefined) {
      form.reset({ name });
    }
  }, [sessionQuery.data?.tenant?.name, form]);

  const mutation = useMutation({
    mutationFn: patchTenant,
    onSuccess: (data) => {
      void queryClient.setQueryData(authMeQueryKey, (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        const p = prev as AuthMeResponse;
        return {
          ...p,
          tenant: data.tenant,
        };
      });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate({ name: values.name.trim() });
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-red-600" role="alert">
          Could not load settings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">
        The organization name appears in the app header for everyone in your
        workspace. Your sign-in URL (tenant slug) is not changed here.
      </p>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Organization</h2>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Input
            label="Organization name"
            {...form.register("name", { required: true })}
            disabled={mutation.isPending}
          />
          {mutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {getErrorMessage(mutation.error)}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
