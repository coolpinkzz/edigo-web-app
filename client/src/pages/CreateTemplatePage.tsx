import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { FeeTemplateAssignPanel } from "../components/fees/FeeTemplateAssignPanel";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  SelectField,
} from "../components/ui";
import { FEE_TYPE_OPTIONS } from "../types";
import type { CreateFeeTemplateFormValues, FeeTemplateDto } from "../types";
import { splitEqualAmounts, todayISODate } from "../utils/installments";
import { cn } from "../utils/cn";
import { useCreateTemplate } from "../hooks/useCreateTemplate";
import { getErrorMessage } from "../utils";

/**
 * Create fee structure (`/fee-templates/new`).
 * Installment rows use calendar dates; API layer converts to `dueInDays` for the server.
 */
export function CreateTemplatePage() {
  const createMutation = useCreateTemplate();
  const [generateCount, setGenerateCount] = useState(2);
  const [createdTemplate, setCreatedTemplate] = useState<FeeTemplateDto | null>(
    null,
  );
  const assignSectionRef = useRef<HTMLDivElement>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    formState: { errors },
  } = useForm<CreateFeeTemplateFormValues>({
    shouldUnregister: true,
    mode: "onChange",
    defaultValues: {
      title: "",
      feeType: "TUITION",
      totalAmount: 0,
      isInstallment: false,
      installments: [],
      defaultEndDate: "",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "installments",
  });

  const isInstallment = useWatch({ control, name: "isInstallment" });
  const totalAmount = useWatch({ control, name: "totalAmount" });
  const installments = useWatch({ control, name: "installments" });
  const titleValue = useWatch({ control, name: "title" });

  useEffect(() => {
    if (!createdTemplate) return;
    assignSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [createdTemplate]);

  /** When installments are enabled, seed two equal rows (or zeros) if the list is empty. */
  useEffect(() => {
    if (!isInstallment) {
      replace([]);
      return;
    }
    if (fields.length === 0) {
      const total = Number(getValues("totalAmount"));
      const amounts = total > 0 ? splitEqualAmounts(total, 2) : [0, 0];
      const start = todayISODate();
      replace([
        { amount: amounts[0] ?? 0, dueDate: start, lateFee: 0 },
        { amount: amounts[1] ?? 0, dueDate: start, lateFee: 0 },
      ]);
    }
  }, [isInstallment, fields.length, replace, getValues]);

  const installmentSum = useMemo(() => {
    if (!isInstallment || !installments?.length)
      return Number(totalAmount) || 0;
    return installments.reduce((s, row) => s + (Number(row?.amount) || 0), 0);
  }, [installments, isInstallment, totalAmount]);

  const totalNum = Number(totalAmount) || 0;
  const sumMatches =
    !isInstallment ||
    Math.abs(installmentSum - totalNum) < 0.005 ||
    totalNum <= 0;

  const rowsComplete =
    !isInstallment ||
    ((installments?.length ?? 0) >= 1 &&
      installments.every(
        (r) =>
          Number(r.amount) > 0 &&
          typeof r.dueDate === "string" &&
          r.dueDate.length > 0,
      ));

  const canSubmit =
    Boolean(titleValue?.trim()) &&
    totalNum > 0 &&
    rowsComplete &&
    sumMatches &&
    !createMutation.isPending;

  const handleGenerateInstallments = () => {
    const total = Number(getValues("totalAmount"));
    if (total <= 0 || generateCount < 1) return;
    const amounts = splitEqualAmounts(total, generateCount);
    const start =
      getValues("installments.0.dueDate")?.toString().trim() || todayISODate();
    const rows = amounts.map((amt) => ({
      amount: amt,
      dueDate: start,
      lateFee: 0,
    }));
    replace(rows);
  };

  const onSubmit = async (data: CreateFeeTemplateFormValues) => {
    clearErrors("root");
    if (data.isInstallment) {
      const sum = data.installments.reduce((s, r) => s + Number(r.amount), 0);
      if (Math.abs(sum - data.totalAmount) > 0.005) {
        setError("root", {
          message: "Installment amounts must equal the total amount.",
        });
        return;
      }
    }
    try {
      const created = await createMutation.mutateAsync(data);
      setCreatedTemplate(created);
    } catch {
      /* mutation error surfaced below */
    }
  };

  const errorMessage =
    createMutation.isError && createMutation.error
      ? getErrorMessage(createMutation.error)
      : null;

  if (createdTemplate) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-10">
        <div className="mb-6">
          <Link
            to="/fee-templates"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Fee structures
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">
            Assign your new fee structure
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The fee structure is saved. Add students below, or skip and assign
            later from the list.
          </p>
        </div>

        <Card className="mb-8 w-full bg-primary/5 shadow-md shadow-primary/15 transition-shadow duration-300">
          <div className="p-6">
            <p className="text-sm font-medium text-primary">
              Fee structure created
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {createdTemplate.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {FEE_TYPE_OPTIONS.find((o) => o.value === createdTemplate.feeType)
                ?.label ?? createdTemplate.feeType}{" "}
              ·{" "}
              {createdTemplate.totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {createdTemplate.isInstallment
                ? ` · ${createdTemplate.defaultInstallments.length} installments`
                : ""}
            </p>
            <div className="mt-4">
              <Link
                to={`/fee-templates/${createdTemplate.id}/assign`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Open full-screen assignment
              </Link>
            </div>
          </div>
        </Card>

        <div ref={assignSectionRef}>
          <FeeTemplateAssignPanel
            templateId={createdTemplate.id}
            templateSummary={{
              title: createdTemplate.title,
              feeType: createdTemplate.feeType,
              totalAmount: createdTemplate.totalAmount,
            }}
            cancelLabel="Skip for now"
            cancelHref="/fee-templates?created=1"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-10">
      <Card className="w-full lg:p-8">
        <div className="mb-6 lg:mb-8">
          <CardTitle>Create fee structure</CardTitle>
          <CardDescription className="mt-2 max-w-3xl text-pretty">
            Define a reusable fee definition. After you create it, you can
            assign it to students on the next step. Installments use dates here;
            the API stores them as days relative to the earliest date.
          </CardDescription>
        </div>

        <form
          className="space-y-6 lg:space-y-8"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6">
            <div className="lg:col-span-2">
              <Input
                label="Title"
                {...register("title", { required: "Title is required" })}
                error={errors.title?.message}
              />
            </div>

            <Controller
              name="feeType"
              control={control}
              rules={{ required: "Fee type is required" }}
              render={({ field }) => (
                <SelectField
                  label="Fee type"
                  name={field.name}
                  options={FEE_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.feeType?.message}
                />
              )}
            />

            <Input
              label="Total amount"
              type="number"
              step="0.01"
              min={0}
              {...register("totalAmount", {
                required: "Total amount is required",
                min: { value: 0.01, message: "Must be greater than 0" },
                valueAsNumber: true,
              })}
              error={errors.totalAmount?.message}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg bg-primary-gradient px-4 py-3 shadow-sm shadow-black/[0.04]">
            <div>
              <p className="text-sm font-medium text-primary-foreground">
                Installment plan
              </p>
              <p className="text-xs text-primary-foreground">
                Split into multiple scheduled payments
              </p>
            </div>
            <Controller
              name="isInstallment"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={cn(
                    "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    field.value ? "bg-primary" : "bg-primary-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-card shadow transition duration-200",
                      field.value ? "translate-x-5" : "translate-x-0.5",
                    )}
                  />
                </button>
              )}
            />
          </div>

          {!isInstallment && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
              <Input
                className="bg-primary-foreground"
                type="date"
                label="Default due date (optional)"
                {...register("defaultEndDate")}
              />
              <p className="text-xs text-muted-foreground">
                Saved on this fee structure. When you assign it to a student,
                new lump-sum fees get this due date (IST) unless you override at
                assignment time. Unpaid fees become overdue after this date.
              </p>
            </div>
          )}

          {isInstallment && (
            <div className="space-y-4 rounded-xl bg-primary/5 p-4 shadow-md shadow-primary/10 transition-all duration-300 lg:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Installments
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Sum must match total amount. Set a due date on each row.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={generateCount}
                      onChange={(e) =>
                        setGenerateCount(Number(e.target.value) || 1)
                      }
                      className="w-20 rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateInstallments}
                  >
                    Generate installments
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      append({ amount: 0, dueDate: todayISODate(), lateFee: 0 })
                    }
                  >
                    + Add
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-3 rounded-lg border border-card-border bg-card p-3 shadow-md shadow-black/[0.06] transition-all duration-200 ease-out sm:flex-row sm:items-end"
                  >
                    <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                      <Input
                        label={`Amount ${index + 1}`}
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`installments.${index}.amount` as const, {
                          required: "Amount is required",
                          min: { value: 0.01, message: "Must be positive" },
                          valueAsNumber: true,
                        })}
                        error={errors.installments?.[index]?.amount?.message}
                      />
                      <Input
                        label="Due date"
                        type="date"
                        {...register(`installments.${index}.dueDate` as const, {
                          required: "Due date is required",
                        })}
                        error={errors.installments?.[index]?.dueDate?.message}
                      />
                      <Input
                        label="Late fee / day"
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`installments.${index}.lateFee` as const, {
                          min: { value: 0, message: "Cannot be negative" },
                          valueAsNumber: true,
                        })}
                        error={errors.installments?.[index]?.lateFee?.message}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 text-red-600 hover:bg-red-50"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      aria-label="Remove installment"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-card px-3 py-2 text-sm shadow-md shadow-black/[0.06] sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">
                  Installment total:{" "}
                  <strong className="text-foreground">
                    {installmentSum.toFixed(2)}
                  </strong>
                  {" · "}
                  Target:{" "}
                  <strong className="text-foreground">
                    {totalNum.toFixed(2)}
                  </strong>
                </span>
                {!sumMatches && totalNum > 0 && (
                  <span className="text-amber-700" role="status">
                    Totals do not match — adjust amounts or total.
                  </span>
                )}
              </div>
            </div>
          )}

          {(errors.root?.message || errorMessage) && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {errors.root?.message ?? errorMessage}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link to="/fee-templates">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              {createMutation.isPending ? "Creating…" : "Create structure"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
