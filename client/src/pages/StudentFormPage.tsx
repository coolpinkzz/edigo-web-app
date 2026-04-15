import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../components/ui";
import { studentToFormValues } from "../api/student.api";
import { useAuthSession } from "../hooks/useAuthSession";
import { useCourses } from "../hooks/useCourses";
import { useCreateStudent } from "../hooks/useCreateStudent";
import { useFeeTemplates } from "../hooks/useFeeTemplates";
import { useFeeTemplate } from "../hooks/useFeeTemplate";
import { useStudent } from "../hooks/useStudent";
import { useUpdateStudent } from "../hooks/useUpdateStudent";
import { STUDENT_CLASS_OPTIONS, STUDENT_SECTION_OPTIONS } from "../types";
import type { CreateStudentFormValues } from "../types";
import { addDaysToISODate, todayISODate } from "../utils/installments";
import { ymdToBusinessMidnightMs } from "../utils/timezone";
import { getErrorMessage } from "../utils";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const DEFAULT_VALUES: CreateStudentFormValues = {
  studentName: "",
  parentName: "",
  parentPhoneNumber: "",
  scholarId: "",
  panNumber: "",
  class: "1st",
  section: "A",
  courseId: "",
  feeTemplateId: "",
  feeTemplateDiscountPercent: "",
  assignmentAnchorDate: "",
  feeEndDate: "",
  useCustomInstallments: false,
  customInstallments: [],
};

/**
 * Create (`/students/new`) or edit (`/students/:studentId/edit`).
 * Fields depend on tenant: SCHOOL (class + section) vs ACADEMY (course from catalog).
 */
export function StudentFormPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const isEdit = Boolean(studentId);
  const sessionQuery = useAuthSession();
  const tenantType = sessionQuery.data?.tenant?.tenantType ?? "SCHOOL";
  const isSchool = tenantType === "SCHOOL";

  const coursesQuery = useCourses(
    { limit: 100, includeInactive: false },
    { enabled: !isSchool && sessionQuery.isSuccess },
  );

  const feeTemplatesQuery = useFeeTemplates(
    { limit: 100 },
    { enabled: !isEdit && sessionQuery.isSuccess },
  );

  const studentQuery = useStudent(isEdit ? studentId : undefined);
  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<CreateStudentFormValues>({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: DEFAULT_VALUES,
  });

  const {
    fields: customInstallmentFields,
    append: appendCustomInstallment,
    remove: removeCustomInstallment,
    replace: replaceCustomInstallments,
  } = useFieldArray({
    control,
    name: "customInstallments",
  });

  useEffect(() => {
    if (!isEdit || !studentQuery.data) return;
    reset(studentToFormValues(studentQuery.data));
  }, [isEdit, studentQuery.data, reset]);

  const onSubmit = (values: CreateStudentFormValues) => {
    clearErrors("root");

    const discountRaw = String(values.feeTemplateDiscountPercent ?? "").trim();
    const discountNum =
      discountRaw === "" ? Number.NaN : Number(discountRaw);
    const discountLocksCustomInstallments =
      Number.isFinite(discountNum) && discountNum > 0;
    const useCustomInstallmentsEffective =
      values.useCustomInstallments && !discountLocksCustomInstallments;

    if (
      !isEdit &&
      isInstallmentTemplateSelected &&
      useCustomInstallmentsEffective
    ) {
      const rows = values.customInstallments ?? [];
      const sum = rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
      const allRowsValid = rows.every((row) => {
        const dateValue = row.dueDate?.trim();
        const dueTs = dateValue
          ? ymdToBusinessMidnightMs(dateValue)
          : Number.NaN;
        return Number(row.amount) > 0 && !Number.isNaN(dueTs);
      });
      if (!allRowsValid) {
        setError("root", {
          message:
            "Custom installments must have positive amounts and valid due dates.",
        });
        return;
      }
      if (
        Math.abs(sum - Number(selectedFeeTemplateDetails?.totalAmount ?? 0)) >=
        0.005
      ) {
        setError("root", {
          message:
            "Custom installment total must match the selected template total amount.",
        });
        return;
      }
    }

    const valuesToSave: CreateStudentFormValues = {
      ...values,
      useCustomInstallments: useCustomInstallmentsEffective,
    };

    if (isEdit && studentId) {
      updateMutation.mutate({ studentId, values: valuesToSave });
      return;
    }
    createMutation.mutate({
      values: valuesToSave,
      feeTemplateIsInstallment: selectedFeeTemplateDetails?.isInstallment,
    });
  };

  const errorMessage =
    errors.root?.message ??
    (createMutation.isError && createMutation.error
      ? getErrorMessage(createMutation.error)
      : null) ??
    (updateMutation.isError && updateMutation.error
      ? getErrorMessage(updateMutation.error)
      : null);

  const pending = createMutation.isPending || updateMutation.isPending;

  const courseOptions = [
    { value: SELECT_EMPTY_VALUE, label: "Select a course" },
    ...(coursesQuery.data?.data ?? [])
      .filter((c) => c.isActive)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  const feeTemplateIdWatch = watch("feeTemplateId");
  const useCustomInstallmentsWatch = watch("useCustomInstallments");
  const customInstallmentsWatch = watch("customInstallments");
  const feeTemplateDiscountPercentWatch = watch("feeTemplateDiscountPercent");
  const hasDiscountLockingCustomInstallments = useMemo(() => {
    const t = String(feeTemplateDiscountPercentWatch ?? "").trim();
    if (t === "") return false;
    const n = Number(t);
    return Number.isFinite(n) && n > 0;
  }, [feeTemplateDiscountPercentWatch]);
  const useCustomInstallmentsEffectiveForForm =
    useCustomInstallmentsWatch && !hasDiscountLockingCustomInstallments;
  const hasFeeTemplateSelected = Boolean(
    feeTemplateIdWatch && String(feeTemplateIdWatch).trim() !== "",
  );
  const selectedTemplateId = String(feeTemplateIdWatch ?? "").trim();
  const selectedTemplateQuery = useFeeTemplate(
    selectedTemplateId !== "" ? selectedTemplateId : undefined,
  );

  const feeTemplateOptions = [
    { value: SELECT_EMPTY_VALUE, label: "None" },
    ...(feeTemplatesQuery.data?.data ?? []).map((t) => ({
      value: t.id,
      label: `${t.title} · ${t.feeType} · ₹${t.totalAmount.toLocaleString("en-IN")}`,
    })),
  ];

  const selectedFeeTemplate = useMemo(() => {
    const id = selectedTemplateId;
    if (!id || !feeTemplatesQuery.data?.data) return undefined;
    return feeTemplatesQuery.data.data.find((t) => t.id === id);
  }, [selectedTemplateId, feeTemplatesQuery.data?.data]);

  const selectedFeeTemplateDetails =
    selectedTemplateQuery.data ?? selectedFeeTemplate;

  const defaultCustomInstallmentRows = useMemo(() => {
    if (!selectedFeeTemplateDetails?.isInstallment) return [];
    const baseDate =
      selectedFeeTemplateDetails.installmentAnchorDate || todayISODate();
    return selectedFeeTemplateDetails.defaultInstallments
      .slice()
      .sort((a, b) => a.dueInDays - b.dueInDays)
      .map((row) => ({
        amount: Number(row.amount),
        dueDate: addDaysToISODate(baseDate, row.dueInDays),
      }));
  }, [selectedFeeTemplateDetails]);

  const isInstallmentTemplateSelected =
    hasFeeTemplateSelected &&
    selectedFeeTemplateDetails?.isInstallment === true;

  useEffect(() => {
    if (!hasFeeTemplateSelected) {
      setValue("feeTemplateDiscountPercent", "");
      setValue("useCustomInstallments", false);
      replaceCustomInstallments([]);
      return;
    }

    if (selectedFeeTemplateDetails?.isInstallment) {
      replaceCustomInstallments(defaultCustomInstallmentRows);
      return;
    }

    setValue("useCustomInstallments", false);
    replaceCustomInstallments([]);
  }, [
    defaultCustomInstallmentRows,
    hasFeeTemplateSelected,
    replaceCustomInstallments,
    selectedFeeTemplateDetails?.isInstallment,
    setValue,
  ]);

  useEffect(() => {
    if (!isInstallmentTemplateSelected || !hasDiscountLockingCustomInstallments) {
      return;
    }
    setValue("useCustomInstallments", false);
    replaceCustomInstallments(defaultCustomInstallmentRows);
  }, [
    defaultCustomInstallmentRows,
    hasDiscountLockingCustomInstallments,
    isInstallmentTemplateSelected,
    replaceCustomInstallments,
    setValue,
  ]);

  const customInstallmentTotal = (customInstallmentsWatch ?? []).reduce(
    (sum, row) => sum + (Number(row?.amount) || 0),
    0,
  );
  const customInstallmentRowsValid = (customInstallmentsWatch ?? []).every(
    (row) =>
      Number(row?.amount) > 0 &&
      typeof row?.dueDate === "string" &&
      row.dueDate.trim() !== "" &&
      !Number.isNaN(ymdToBusinessMidnightMs(row.dueDate)),
  );
  const customInstallmentTotalMatches =
    !isInstallmentTemplateSelected ||
    !useCustomInstallmentsEffectiveForForm ||
    Math.abs(
      customInstallmentTotal -
        Number(selectedFeeTemplateDetails?.totalAmount ?? 0),
    ) < 0.005;
  const customInstallmentsValid =
    !isInstallmentTemplateSelected ||
    !useCustomInstallmentsEffectiveForForm ||
    ((customInstallmentsWatch?.length ?? 0) > 0 &&
      customInstallmentRowsValid &&
      customInstallmentTotalMatches);

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          Could not load organization settings. Try refreshing the page.
        </p>
        <Link
          to="/students"
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Back to students
        </Link>
      </div>
    );
  }

  if (isEdit && studentQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading student…</p>
      </div>
    );
  }

  if (isEdit && studentQuery.isError) {
    return (
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          {studentQuery.error instanceof Error
            ? studentQuery.error.message
            : "Failed to load student"}
        </p>
        <Link
          to="/students"
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Back to students
        </Link>
      </div>
    );
  }

  if (!isSchool && coursesQuery.isError) {
    return (
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          Could not load courses. Add courses under Courses in the sidebar, then
          try again.
        </p>
        <Link
          to="/courses"
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Go to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center px-4 py-10">
      <Card className="w-full transition-shadow duration-300">
        <div className="mb-6">
          <CardTitle>{isEdit ? "Edit student" : "Add student"}</CardTitle>
          <CardDescription>
            {isSchool
              ? isEdit
                ? "Update profile. Class and section are required for your organization."
                : "Enter details. Class and section identify the student’s cohort."
              : isEdit
                ? "Update profile. A course from your catalog is required."
                : "Enter details and assign an active course from your catalog."}
          </CardDescription>
        </div>

        <form
          className="space-y-6"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Input
            label="Student name"
            {...register("studentName", {
              required: "Student name is required",
            })}
            error={errors.studentName?.message}
          />

          <Input
            label="Scholar ID"
            placeholder="Optional"
            {...register("scholarId")}
            error={errors.scholarId?.message}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Parent / guardian name"
              {...register("parentName", {
                required: "Parent name is required",
              })}
              error={errors.parentName?.message}
            />
            <Input
              label="Parent phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10 digits"
              {...register("parentPhoneNumber", {
                required: "Parent phone is required",
                validate: (v) => {
                  const d = String(v).replace(/\D/g, "");
                  return (
                    d.length === 10 ||
                    "Must be exactly 10 digits (no country code)"
                  );
                },
              })}
              error={errors.parentPhoneNumber?.message}
            />
          </div>

          <Input
            label="PAN"
            placeholder="e.g. ABCDE1234F"
            {...register("panNumber", {
              validate: (v) => {
                const t = String(v).trim().toUpperCase();
                if (!t) return true;
                return PAN_RE.test(t) || "Invalid PAN (e.g. ABCDE1234F)";
              },
            })}
            error={errors.panNumber?.message}
          />

          {isSchool ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="class"
                control={control}
                rules={{ required: "Class is required" }}
                render={({ field }) => (
                  <SelectField
                    label="Class"
                    name={field.name}
                    options={STUDENT_CLASS_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.class?.message}
                  />
                )}
              />
              <Controller
                name="section"
                control={control}
                rules={{ required: "Section is required" }}
                render={({ field }) => (
                  <SelectField
                    label="Section"
                    name={field.name}
                    options={STUDENT_SECTION_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.section?.message}
                  />
                )}
              />
            </div>
          ) : (
            <Controller
              name="courseId"
              control={control}
              rules={{
                validate: (v) => {
                  if (coursesQuery.isLoading) return true;
                  if (!v || String(v).trim() === "") {
                    return "Course is required";
                  }
                  return true;
                },
              }}
              render={({ field }) => (
                <SelectField
                  label="Course"
                  name={field.name}
                  options={courseOptions}
                  value={
                    !field.value || field.value === ""
                      ? SELECT_EMPTY_VALUE
                      : field.value
                  }
                  onValueChange={(v) =>
                    field.onChange(v === SELECT_EMPTY_VALUE ? "" : v)
                  }
                  onBlur={field.onBlur}
                  error={errors.courseId?.message}
                  disabled={coursesQuery.isLoading}
                />
              )}
            />
          )}

          {!isEdit && (
            <div className="space-y-4 border-t border-border pt-6">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Fee (optional)
                </p>
                <p className="text-sm text-muted-foreground">
                  Create the student&apos;s first fee from a saved template. You
                  can add fees later from the student page if you skip this.
                </p>
              </div>
              {feeTemplatesQuery.isError && (
                <p
                  className="text-sm text-amber-800 dark:text-amber-200"
                  role="status"
                >
                  Could not load fee templates. Save without a template or try
                  again in a moment.
                </p>
              )}
              <Controller
                name="feeTemplateId"
                control={control}
                render={({ field }) => (
                  <SelectField
                    label="Fee template"
                    name={field.name}
                    options={feeTemplateOptions}
                    value={
                      !field.value || field.value === ""
                        ? SELECT_EMPTY_VALUE
                        : field.value
                    }
                    onValueChange={(v) =>
                      field.onChange(v === SELECT_EMPTY_VALUE ? "" : v)
                    }
                    onBlur={field.onBlur}
                    disabled={feeTemplatesQuery.isLoading}
                  />
                )}
              />
              {hasFeeTemplateSelected && (
                <Input
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  label="Discount % (optional)"
                  placeholder="0"
                  {...register("feeTemplateDiscountPercent", {
                    validate: (v) => {
                      const t = String(v ?? "").trim();
                      if (t === "") return true;
                      const n = Number(t);
                      if (!Number.isFinite(n)) {
                        return "Discount must be a valid number";
                      }
                      if (n < 0 || n > 100) {
                        return "Discount must be between 0 and 100";
                      }
                      return true;
                    },
                  })}
                  error={errors.feeTemplateDiscountPercent?.message}
                />
              )}
              {feeTemplatesQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading templates…
                </p>
              )}
              {hasFeeTemplateSelected && selectedTemplateQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading selected template details…
                </p>
              )}
              {isInstallmentTemplateSelected && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                  <Input
                    type="date"
                    label="Installment anchor date (optional)"
                    {...register("assignmentAnchorDate")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Due dates are computed from this anchor (IST) when you do
                    not customize installments.
                  </p>

                  <Controller
                    name="useCustomInstallments"
                    control={control}
                    render={({ field }) => {
                      const switchOn =
                        field.value && !hasDiscountLockingCustomInstallments;
                      return (
                      <div
                        className={`flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 ${
                          hasDiscountLockingCustomInstallments
                            ? "opacity-80"
                            : ""
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Customize installments for this student
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Optional override for this student only; template
                            remains unchanged.
                            {hasDiscountLockingCustomInstallments && (
                              <>
                                {" "}
                                <span className="text-foreground">
                                  Not available while a discount is set—clear
                                  discount % above to customize.
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={switchOn}
                          disabled={hasDiscountLockingCustomInstallments}
                          aria-disabled={hasDiscountLockingCustomInstallments}
                          onClick={() => field.onChange(!field.value)}
                          className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                            hasDiscountLockingCustomInstallments
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer"
                          } ${
                            switchOn
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-card shadow transition duration-200 ${
                              switchOn ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>
                      );
                    }}
                  />

                  {useCustomInstallmentsEffectiveForForm && (
                    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                      {customInstallmentFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
                        >
                          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                            <Input
                              label={`Amount ${index + 1}`}
                              type="number"
                              step="0.01"
                              min={0}
                              {...register(
                                `customInstallments.${index}.amount` as const,
                                {
                                  valueAsNumber: true,
                                },
                              )}
                            />
                            <Input
                              label="Due date"
                              type="date"
                              {...register(
                                `customInstallments.${index}.dueDate` as const,
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="shrink-0 text-red-600 hover:bg-red-50"
                            onClick={() => removeCustomInstallment(index)}
                            disabled={customInstallmentFields.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            appendCustomInstallment({
                              amount: 0,
                              dueDate: todayISODate(),
                            })
                          }
                        >
                          + Add installment
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          Total:{" "}
                          <strong className="text-foreground">
                            {customInstallmentTotal.toFixed(2)}
                          </strong>
                          {" · "}Target:{" "}
                          <strong className="text-foreground">
                            {Number(
                              selectedFeeTemplateDetails?.totalAmount ?? 0,
                            ).toFixed(2)}
                          </strong>
                        </p>
                      </div>
                      {!customInstallmentsValid && (
                        <p className="text-xs text-amber-700">
                          Ensure each row has a positive amount, valid date, and
                          the total matches the template amount.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {hasFeeTemplateSelected &&
                selectedFeeTemplateDetails?.isInstallment === false && (
                  <div className="space-y-1.5">
                    <Input
                      type="date"
                      label="Fee due date (optional)"
                      {...register("feeEndDate")}
                    />
                    <p className="text-xs text-muted-foreground">
                      For this lump-sum fee, overdue status uses this due date
                      (IST) when unpaid. You can leave empty to use the
                      template&apos;s default due date, if any.
                    </p>
                  </div>
                )}
            </div>
          )}

          {errorMessage && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link to="/students">
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
              disabled={
                pending ||
                (!isSchool && coursesQuery.isLoading) ||
                (!isEdit && !customInstallmentsValid)
              }
              className="w-full sm:w-auto"
            >
              {pending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create student"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
