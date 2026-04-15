import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ConfirmationModal,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../ui";
import { useAssignFeeTemplate } from "../../hooks/useAssignFeeTemplate";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useStudents } from "../../hooks/useStudents";
import {
  FEE_TYPE_OPTIONS,
  STUDENT_CLASS_OPTIONS,
  STUDENT_SECTION_OPTIONS,
} from "../../types";
import type {
  AssignTemplateToFeesPayload,
  AssignTemplateToFeesResult,
  FeeType,
  StudentClass,
  StudentSection,
} from "../../types";
import { cn, getErrorMessage } from "../../utils";

const MAX_MANUAL_SELECTION = 500;
const STUDENT_PAGE_SIZE = 20;

const SECTION_ANY = "";

export type AssignMode = "class" | "manual";

const classFilterOptions = [
  { value: SELECT_EMPTY_VALUE, label: "All classes" },
  ...STUDENT_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

const sectionAssignOptions = [
  { value: SELECT_EMPTY_VALUE, label: "All sections in this class" },
  ...STUDENT_SECTION_OPTIONS.map((o) => ({
    value: o.value,
    label: `Section ${o.value}`,
  })),
];

export interface FeeTemplateAssignSummary {
  title: string;
  feeType: FeeType;
  totalAmount: number;
}

export interface FeeTemplateAssignPanelProps {
  templateId: string;
  templateSummary: FeeTemplateAssignSummary;
  /** When set, overrides default “Cancel” label (e.g. “Skip for now” on create flow). */
  cancelLabel?: string;
  /** Where the cancel/skip link goes. */
  cancelHref?: string;
}

function feeTypeLabel(feeType: FeeType): string {
  return FEE_TYPE_OPTIONS.find((o) => o.value === feeType)?.label ?? feeType;
}

/**
 * Shared UI for POST /fee-templates/:id/assign — by class/section or manual student pick.
 */
export function FeeTemplateAssignPanel({
  templateId,
  templateSummary,
  cancelLabel = "Cancel",
  cancelHref = "/fee-templates",
}: FeeTemplateAssignPanelProps) {
  const assignMutation = useAssignFeeTemplate();
  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const [mode, setMode] = useState<AssignMode>("class");
  const [assignClass, setAssignClass] = useState<StudentClass>("1st");
  const [assignSection, setAssignSection] = useState<string>(SECTION_ANY);

  const [filterClass, setFilterClass] = useState<"" | StudentClass>("");
  const [studentPage, setStudentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [success, setSuccess] = useState<AssignTemplateToFeesResult | null>(null);
  const [alertModal, setAlertModal] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    if (!isSchool) {
      setMode("manual");
    }
  }, [isSchool]);

  useEffect(() => {
    return () => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false);
        confirmResolveRef.current = null;
      }
    };
  }, []);

  const previewQuery = useStudents(
    {
      page: 1,
      limit: 1,
      class: assignClass,
    },
    { enabled: isSchool && mode === "class" },
  );

  const listQuery = useStudents(
    {
      page: studentPage,
      limit: STUDENT_PAGE_SIZE,
      class: isSchool ? filterClass || undefined : undefined,
    },
    { enabled: mode === "manual" },
  );

  const classTotal = previewQuery.data?.total;

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= MAX_MANUAL_SELECTION) return prev;
      return [...prev, id];
    });
  };

  const selectAllOnPage = () => {
    const rows = listQuery.data?.data ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of rows) {
        if (next.size >= MAX_MANUAL_SELECTION) break;
        next.add(s.id);
      }
      return Array.from(next);
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const openAlertModal = (description: string, title = "Cannot continue") => {
    setAlertModal({
      open: true,
      title,
      description,
    });
  };

  const askForConfirm = (
    description: string,
    title = "Please confirm",
  ): Promise<boolean> => {
    setConfirmModal({
      open: true,
      title,
      description,
    });
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
    });
  };

  const resolveConfirmModal = (value: boolean) => {
    setConfirmModal((prev) => ({ ...prev, open: false }));
    if (confirmResolveRef.current) {
      confirmResolveRef.current(value);
      confirmResolveRef.current = null;
    }
  };

  const handleSubmit = async () => {
    const { title } = templateSummary;

    if (mode === "class") {
      const sectionLabel =
        assignSection && assignSection !== SECTION_ANY
          ? ` · section ${assignSection}`
          : "";
      const confirmed = await askForConfirm(
        `Assign “${title}” to all students in ${assignClass}${sectionLabel}?`,
        "Confirm assignment",
      );
      if (!confirmed) {
        return;
      }
      const body: AssignTemplateToFeesPayload = {
        templateId,
        assignmentType: "CLASS",
        class: assignClass,
      };
      if (assignSection && assignSection !== SECTION_ANY) {
        body.section = assignSection as StudentSection;
      }
      try {
        const result = await assignMutation.mutateAsync({ body });
        setSuccess(result);
      } catch {
        /* error surfaced via mutation */
      }
      return;
    }

    if (selectedIds.length === 0) {
      openAlertModal("Select at least one student, or switch to “By class”.");
      return;
    }
    const confirmed = await askForConfirm(
      `Assign “${title}” to ${selectedIds.length} student(s)?`,
      "Confirm assignment",
    );
    if (!confirmed) {
      return;
    }
    const body: AssignTemplateToFeesPayload = {
      templateId,
      assignmentType: "STUDENTS",
      studentIds: selectedIds,
    };
    try {
      const result = await assignMutation.mutateAsync({ body });
      setSuccess(result);
    } catch {
      /* error surfaced via mutation */
    }
  };

  const resetFlow = () => {
    setSuccess(null);
    setSelectedIds([]);
    setStudentPage(1);
  };

  const canSubmitClass = isSchool && mode === "class";
  const canSubmitManual =
    mode === "manual" &&
    selectedIds.length > 0 &&
    selectedIds.length <= MAX_MANUAL_SELECTION;
  const canSubmit =
    (canSubmitClass || canSubmitManual) &&
    !assignMutation.isPending &&
    !success;

  if (success) {
    return (
      <div
        className="rounded-xl bg-accent px-5 py-6 text-foreground shadow-lg shadow-black/[0.06]"
        role="status"
      >
        <h2 className="text-lg font-semibold text-accent-foreground">
          Assignment complete
        </h2>
        <p className="mt-2 text-sm text-accent-foreground">
          <strong>{success.assignedCount}</strong> student
          {success.assignedCount === 1 ? "" : "s"} received fees from this fee
          structure.
        </p>
        {success.skippedDuplicateCount > 0 && (
          <p className="mt-2 text-sm text-accent-foreground/90">
            <strong>{success.skippedDuplicateCount}</strong> already had this
            fee structure — skipped (no duplicate fees).
          </p>
        )}
        <p className="mt-3 text-sm text-accent-foreground/90">
          Online payments are started from the student fee screen (Pay now) —
          not at assignment time.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/fee-templates">
            <Button type="button" variant="secondary">
              Back to fee structures
            </Button>
          </Link>
          <Button type="button" onClick={resetFlow}>
            Assign again
          </Button>
        </div>
      </div>
    );
  }

  const { title, feeType, totalAmount } = templateSummary;

  return (
    <Card className="p-0! overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <CardTitle className="text-lg">Who should receive this fee?</CardTitle>
        <CardDescription>
          {isSchool
            ? "Use either a class filter or pick students — not both. Duplicates are skipped automatically."
            : "Pick students to assign. Duplicates are skipped automatically."}
        </CardDescription>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/90">{title}</span>
          {" · "}
          {feeTypeLabel(feeType)} ·{" "}
          {totalAmount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      <div className="space-y-6 px-6 py-6">
        {isSchool ? (
          <div
            className="flex rounded-lg border border-border bg-muted p-1"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "class"}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === "class"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setMode("class");
                setSuccess(null);
              }}
            >
              By class
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "manual"}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                mode === "manual"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setMode("manual");
                setSuccess(null);
              }}
            >
              Choose students
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground">
            Choose students
          </p>
        )}

        {mode === "class" && isSchool && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Class"
                options={STUDENT_CLASS_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                value={assignClass}
                onValueChange={(v) => setAssignClass(v as StudentClass)}
                name="assign-class"
              />
              <SelectField
                label="Section (optional)"
                options={sectionAssignOptions}
                value={
                  assignSection === SECTION_ANY
                    ? SELECT_EMPTY_VALUE
                    : assignSection
                }
                onValueChange={(v) =>
                  setAssignSection(
                    v === SELECT_EMPTY_VALUE ? SECTION_ANY : v,
                  )
                }
                name="assign-section"
              />
            </div>
            {previewQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading class size…
              </p>
            )}
            {!previewQuery.isLoading && classTotal !== undefined && (
              <p className="text-sm text-muted-foreground">
                {assignSection && assignSection !== SECTION_ANY ? (
                  <>
                    Directory lists <strong>{classTotal}</strong> students in{" "}
                    <strong>{assignClass}</strong> (all sections). Assignment
                    will target only <strong>section {assignSection}</strong>.
                  </>
                ) : (
                  <>
                    About <strong>{classTotal}</strong> active students in{" "}
                    <strong>{assignClass}</strong> match this filter.
                  </>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              If a class is very large, add a section to narrow the group. The
              server may reject a class-only run if it matches too many students
              — use a section in that case.
            </p>
          </div>
        )}

        {mode === "manual" && (
          <div className="space-y-4">
            {isSchool && (
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[12rem]">
                  <SelectField
                    label="Filter by class"
                    name="manual-class"
                    options={classFilterOptions}
                    value={
                      filterClass === ""
                        ? SELECT_EMPTY_VALUE
                        : filterClass
                    }
                    onValueChange={(v) => {
                      setStudentPage(1);
                      setFilterClass(
                        v === SELECT_EMPTY_VALUE ? "" : (v as StudentClass),
                      );
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground/80">
                Selected{" "}
                <strong className="tabular-nums">{selectedIds.length}</strong> /{" "}
                {MAX_MANUAL_SELECTION}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={selectAllOnPage}
                  disabled={
                    !listQuery.data?.data.length ||
                    selectedIds.length >= MAX_MANUAL_SELECTION
                  }
                >
                  Select all on page
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-1.5 text-xs"
                  onClick={clearSelection}
                  disabled={selectedIds.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
            {listQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Loading students…</p>
            )}
            {listQuery.isError && (
              <p className="text-sm text-red-600" role="alert">
                Failed to load students.
              </p>
            )}
            {!listQuery.isLoading &&
              !listQuery.isError &&
              listQuery.data &&
              listQuery.data.data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No students match these filters.
                </p>
              )}
            {!listQuery.isLoading &&
              listQuery.data &&
              listQuery.data.data.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-card-border bg-card shadow-md shadow-black/[0.06]">
                  <table className="w-full min-w-[24rem] text-left text-sm">
                    <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                      <tr>
                        <th className="w-10 px-3 py-2" />
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">
                          {isSchool ? "Class" : "Course"}
                        </th>
                        <th className="px-3 py-2 font-medium">Parent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {listQuery.data.data.map((s) => {
                        const checked = selectedIds.includes(s.id);
                        const atCap =
                          !checked &&
                          selectedIds.length >= MAX_MANUAL_SELECTION;
                        return (
                          <tr key={s.id} className="bg-card">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border bg-background accent-primary focus:ring-2 focus:ring-primary/30"
                                checked={checked}
                                disabled={atCap}
                                onChange={() => toggleStudent(s.id)}
                                aria-label={`Select ${s.studentName}`}
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground">
                              {s.studentName}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {isSchool
                                ? `${s.class ?? "—"} · ${s.section ?? "—"}`
                                : s.course?.name ?? s.courseId ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {s.parentName}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            {listQuery.data && listQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Page {listQuery.data.page} of {listQuery.data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={studentPage <= 1}
                    onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={studentPage >= listQuery.data.totalPages}
                    onClick={() =>
                      setStudentPage((p) =>
                        p < listQuery.data!.totalPages ? p + 1 : p,
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {assignMutation.isError && assignMutation.error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {getErrorMessage(assignMutation.error)}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Link to={cancelHref}>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              {cancelLabel}
            </Button>
          </Link>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {assignMutation.isPending ? "Assigning…" : "Assign Template"}
          </Button>
        </div>
        <ConfirmationModal
          open={alertModal.open}
          onOpenChange={(open) =>
            setAlertModal((prev) => ({ ...prev, open }))
          }
          title={alertModal.title}
          description={alertModal.description}
          onConfirm={() =>
            setAlertModal((prev) => ({ ...prev, open: false }))
          }
          confirmLabel="OK"
          cancelLabel="Close"
        />
        <ConfirmationModal
          open={confirmModal.open}
          onOpenChange={(open) => {
            setConfirmModal((prev) => ({ ...prev, open }));
            if (!open && confirmResolveRef.current) {
              confirmResolveRef.current(false);
              confirmResolveRef.current = null;
            }
          }}
          title={confirmModal.title}
          description={confirmModal.description}
          onConfirm={() => resolveConfirmModal(true)}
          confirmLabel="Confirm"
          cancelLabel="Cancel"
        />
      </div>
    </Card>
  );
}
