import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ConfirmationModal,
  Input,
  SelectField,
} from "../components/ui";
import {
  buildFeeLumpSumPaymentPayload,
  buildInstallmentPaymentPayload,
} from "../api/fee.api";
import { useAuthSession } from "../hooks/useAuthSession";
import { useFee } from "../hooks/useFee";
import { useFees } from "../hooks/useFees";
import { useStudent } from "../hooks/useStudent";
import { usePatchFee } from "../hooks/usePatchFee";
import { useUpdateFeePayment } from "../hooks/useUpdateFeePayment";
import { useUpdateInstallment } from "../hooks/useUpdateInstallment";
import type {
  FeeDto,
  FeeStatus,
  InstallmentDto,
  ManualPaymentMethod,
  PatchFeePayload,
} from "../types";
import { businessDayKey, ymdToBusinessMidnightIso } from "../utils/timezone";
import { cn, getErrorMessage } from "../utils";

const FEE_PAGE_SIZE = 20;

const PAYMENT_METHOD_OPTIONS: { value: ManualPaymentMethod; label: string }[] =
  [
    { value: "CASH", label: "Cash" },
    { value: "CHEQUE", label: "Cheque" },
  ];

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** HTML date input value (YYYY-MM-DD) from an ISO string from the API. */
function isoToDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return businessDayKey(d);
}

function statusBadgeClass(status: FeeStatus): string {
  switch (status) {
    case "PAID":
      return "bg-accent text-accent-foreground";
    case "OVERDUE":
      return "bg-red-100 text-red-900";
    case "PARTIAL":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-muted text-foreground/90";
  }
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/**
 * Student profile with fees list; expand a fee to load installments (GET /fees/:feeId).
 */
export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [feePage, setFeePage] = useState(1);
  const [expandedFeeId, setExpandedFeeId] = useState<string | null>(null);
  const [recordingInstallmentId, setRecordingInstallmentId] = useState<
    string | null
  >(null);
  const [instPaidInput, setInstPaidInput] = useState("");
  const [instMethod, setInstMethod] = useState<ManualPaymentMethod>("CASH");
  const [instReference, setInstReference] = useState("");
  const [showLumpSumForm, setShowLumpSumForm] = useState(false);
  const [lumpPaidInput, setLumpPaidInput] = useState("");
  const [lumpMethod, setLumpMethod] = useState<ManualPaymentMethod>("CASH");
  const [lumpReference, setLumpReference] = useState("");
  const [paymentValidationModal, setPaymentValidationModal] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({ open: false, title: "", description: "" });
  const [lumpScheduleEnd, setLumpScheduleEnd] = useState("");

  const openPaymentValidationModal = (
    description: string,
    title = "Cannot save payment",
  ) => {
    setPaymentValidationModal({
      open: true,
      title,
      description,
    });
  };

  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const studentQuery = useStudent(studentId);
  const feesQuery = useFees({
    studentId: studentId ?? "",
    page: feePage,
    limit: FEE_PAGE_SIZE,
    enabled: Boolean(studentId),
  });
  const feeDetailQuery = useFee(expandedFeeId ?? undefined);
  const updateInstallmentMutation = useUpdateInstallment();
  const updateFeePaymentMutation = useUpdateFeePayment();
  const patchFeeMutation = usePatchFee();

  const toggleFee = (id: string) => {
    setExpandedFeeId((prev) => (prev === id ? null : id));
    setRecordingInstallmentId(null);
    setShowLumpSumForm(false);
  };

  const student = studentQuery.data;

  const handleCopyPhone = async () => {
    if (!student?.parentPhoneNumber) return;
    await copyText(student.parentPhoneNumber);
  };

  const openInstallmentPayment = (inst: InstallmentDto) => {
    setRecordingInstallmentId(inst.id);
    setInstPaidInput(String(inst.amount));
    setInstMethod("CASH");
    setInstReference("");
  };

  const submitInstallmentPayment = async (
    feeId: string,
    inst: InstallmentDto,
  ) => {
    const paid = Number.parseFloat(instPaidInput);
    if (Number.isNaN(paid) || paid < 0) {
      openPaymentValidationModal("Enter a valid paid amount (0 or more).");
      return;
    }
    if (paid > inst.amount + 1e-9) {
      openPaymentValidationModal(
        `Paid cannot exceed installment amount (${formatMoney(inst.amount)}).`,
      );
      return;
    }
    const ref = instReference.trim();
    if (!ref) {
      openPaymentValidationModal(
        "Enter a reference (cheque no., receipt, or transaction id).",
      );
      return;
    }
    try {
      await updateInstallmentMutation.mutateAsync({
        feeId,
        installmentId: inst.id,
        body: buildInstallmentPaymentPayload(inst.metadata, {
          paidAmount: paid,
          paymentMethod: instMethod,
          paymentReference: ref,
        }),
      });
      setRecordingInstallmentId(null);
    } catch {
      /* mutation error surfaced below */
    }
  };

  const submitLumpSumPayment = async (fee: FeeDto) => {
    const paid = Number.parseFloat(lumpPaidInput);
    if (Number.isNaN(paid) || paid < 0) {
      openPaymentValidationModal("Enter a valid paid amount (0 or more).");
      return;
    }
    if (paid > fee.totalAmount + 1e-9) {
      openPaymentValidationModal(
        `Paid cannot exceed fee total (${formatMoney(fee.totalAmount)}).`,
      );
      return;
    }
    const ref = lumpReference.trim();
    if (!ref) {
      openPaymentValidationModal(
        "Enter a reference (cheque no., receipt, or transaction id).",
      );
      return;
    }
    try {
      await updateFeePaymentMutation.mutateAsync({
        feeId: fee.id,
        body: buildFeeLumpSumPaymentPayload(fee.metadata, {
          paidAmount: paid,
          paymentMethod: lumpMethod,
          paymentReference: ref,
        }),
      });
      setShowLumpSumForm(false);
    } catch {
      /* surfaced below */
    }
  };

  const openLumpSumForm = (fee: FeeDto) => {
    setShowLumpSumForm(true);
    setLumpPaidInput(String(fee.totalAmount));
    setLumpMethod("CASH");
    setLumpReference("");
  };

  const feeDetailFee = feeDetailQuery.data?.fee;
  useEffect(() => {
    if (!feeDetailFee || feeDetailFee.isInstallment) return;
    setLumpScheduleEnd(isoToDateInput(feeDetailFee.endDate));
  }, [feeDetailFee?.id, feeDetailFee?.isInstallment, feeDetailFee?.endDate]);

  const submitLumpSchedule = async (fee: FeeDto) => {
    const body: PatchFeePayload = {};
    const end = lumpScheduleEnd.trim();
    if (end) body.endDate = ymdToBusinessMidnightIso(end);
    if (Object.keys(body).length === 0) {
      openPaymentValidationModal(
        "Set a due date before saving.",
        "Cannot save schedule",
      );
      return;
    }
    try {
      await patchFeeMutation.mutateAsync({ feeId: fee.id, body });
    } catch {
      /* surfaced below */
    }
  };

  if (!studentId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-red-600">Missing student.</p>
        <Link to="/students" className="mt-2 inline-block text-sm text-primary">
          Back to students
        </Link>
      </div>
    );
  }

  if (studentQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading student…</p>
      </div>
    );
  }

  if (studentQuery.isError || !student) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          {studentQuery.error instanceof Error
            ? studentQuery.error.message
            : "Student not found."}
        </p>
        <Link to="/students" className="mt-2 inline-block text-sm text-primary">
          Back to students
        </Link>
      </div>
    );
  }

  const feesData = feesQuery.data;
  const feePages = feesData?.totalPages ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          to="/students"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Students
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {student.studentName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSchool ? (
                <>
                  {student.class ?? "—"} · Section {student.section ?? "—"}
                  {student.scholarId ? ` · Scholar ${student.scholarId}` : ""}
                </>
              ) : (
                <>
                  {student.course?.name ?? student.courseId ?? "—"}
                  {student.scholarId ? ` · Scholar ${student.scholarId}` : ""}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCopyPhone()}
            >
              Copy parent phone
            </Button>
            <Link to={`/students/${studentId}/edit`}>
              <Button type="button" variant="secondary">
                Edit student
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Card className="p-0! overflow-hidden">
        <div className="px-6 py-4">
          <CardTitle className="text-lg ">Fees</CardTitle>
          <CardDescription className="text-muted-foreground">
            Expand a fee to set due dates (lump-sum), record cash/cheque
            payments on installments, or a single lump-sum payment.
          </CardDescription>
        </div>

        {feesQuery.isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            Loading fees…
          </p>
        )}

        {feesQuery.isError && (
          <p className="px-6 py-8 text-sm text-red-600" role="alert">
            Failed to load fees.
          </p>
        )}

        {!feesQuery.isLoading &&
          !feesQuery.isError &&
          feesData &&
          feesData.data.length === 0 && (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              No fees recorded for this student yet.
            </p>
          )}

        {!feesQuery.isLoading &&
          !feesQuery.isError &&
          feesData &&
          feesData.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                  <tr>
                    <th className="w-10 px-4 py-3" aria-hidden />
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Paid</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Pending
                    </th>
                    <th className="px-4 py-3 font-medium">Due by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {feesData.data.map((fee) => {
                    const isOpen = expandedFeeId === fee.id;
                    return (
                      <Fragment key={fee.id}>
                        <tr
                          className={cn(
                            "cursor-pointer bg-card hover:bg-muted/80",
                            isOpen && "bg-primary/10",
                          )}
                          onClick={() => toggleFee(fee.id)}
                        >
                          <td
                            className="px-4 py-3 text-muted-foreground"
                            aria-hidden
                          >
                            <span className="inline-block w-4 text-center">
                              {isOpen ? "▼" : "▶"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {fee.title}
                            {fee.isInstallment && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                (installment plan)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fee.feeType}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                statusBadgeClass(fee.status),
                              )}
                            >
                              {fee.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground">
                            {formatMoney(fee.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                            {formatMoney(fee.paidAmount)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                            {formatMoney(fee.pendingAmount)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fee.isInstallment
                              ? "—"
                              : fee.endDate
                                ? formatDate(fee.endDate)
                                : "—"}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={8} className="px-4 py-4">
                              {feeDetailQuery.isLoading && (
                                <p className="text-sm text-muted-foreground">
                                  Loading installments…
                                </p>
                              )}
                              {feeDetailQuery.isError && (
                                <p
                                  className="text-sm text-red-600"
                                  role="alert"
                                >
                                  Could not load fee details.
                                </p>
                              )}
                              {feeDetailQuery.data && (
                                <div className="space-y-4">
                                  {!feeDetailQuery.data.fee.isInstallment && (
                                    <div className="rounded-lg border border-card-border p-4 shadow-md shadow-black/[0.06]">
                                      <p className="text-sm text-muted-foreground">
                                        Single payment — no installment
                                        schedule.
                                      </p>
                                      <p className="mt-2 text-sm text-foreground/80">
                                        Total{" "}
                                        {formatMoney(
                                          feeDetailQuery.data.fee.totalAmount,
                                        )}{" "}
                                        · Paid{" "}
                                        {formatMoney(
                                          feeDetailQuery.data.fee.paidAmount,
                                        )}{" "}
                                        · Pending{" "}
                                        {formatMoney(
                                          feeDetailQuery.data.fee.pendingAmount,
                                        )}
                                      </p>
                                      <div
                                        className="mt-4 space-y-3 border-t border-border/60 pt-4"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <p className="text-xs text-muted-foreground">
                                          <strong className="font-medium text-foreground/90">
                                            Due date (IST)
                                          </strong>
                                          {" — "}
                                          Only applies to lump-sum fees. For
                                          unpaid fees, status becomes overdue
                                          after this date. Installment fees use
                                          installment due dates instead.
                                        </p>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                          <div className="sm:w-56">
                                            <Input
                                              type="date"
                                              label="Due date (optional)"
                                              value={lumpScheduleEnd}
                                              onChange={(e) =>
                                                setLumpScheduleEnd(
                                                  e.target.value,
                                                )
                                              }
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            className="sm:mb-0 sm:shrink-0"
                                            disabled={
                                              patchFeeMutation.isPending
                                            }
                                            onClick={() =>
                                              void submitLumpSchedule(
                                                feeDetailQuery.data.fee,
                                              )
                                            }
                                          >
                                            {patchFeeMutation.isPending
                                              ? "Saving…"
                                              : "Save schedule"}
                                          </Button>
                                        </div>
                                        {patchFeeMutation.isError &&
                                          patchFeeMutation.error && (
                                            <p
                                              className="text-sm text-red-600"
                                              role="alert"
                                            >
                                              {getErrorMessage(
                                                patchFeeMutation.error,
                                              )}
                                            </p>
                                          )}
                                      </div>
                                      {!showLumpSumForm ? (
                                        <Button
                                          type="button"
                                          variant="primary"
                                          className="mt-3"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openLumpSumForm(
                                              feeDetailQuery.data.fee,
                                            );
                                          }}
                                        >
                                          Record payment
                                        </Button>
                                      ) : (
                                        <div
                                          className="mt-4 space-y-3 border-t border-border/60 pt-4"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Input
                                            label="Total amount recorded as paid"
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            value={lumpPaidInput}
                                            onChange={(e) =>
                                              setLumpPaidInput(e.target.value)
                                            }
                                          />
                                          <SelectField
                                            label="Method"
                                            name="lump-method"
                                            options={PAYMENT_METHOD_OPTIONS.map(
                                              (o) => ({
                                                value: o.value,
                                                label: o.label,
                                              }),
                                            )}
                                            value={lumpMethod}
                                            onValueChange={(v) =>
                                              setLumpMethod(
                                                v as ManualPaymentMethod,
                                              )
                                            }
                                          />
                                          <Input
                                            label="Reference"
                                            placeholder="Cheque no. / receipt"
                                            required
                                            value={lumpReference}
                                            onChange={(e) =>
                                              setLumpReference(e.target.value)
                                            }
                                          />
                                          <div className="flex flex-wrap gap-2">
                                            <Button
                                              type="button"
                                              disabled={
                                                updateFeePaymentMutation.isPending
                                              }
                                              onClick={() =>
                                                void submitLumpSumPayment(
                                                  feeDetailQuery.data!.fee,
                                                )
                                              }
                                            >
                                              {updateFeePaymentMutation.isPending
                                                ? "Saving…"
                                                : "Save payment"}
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              onClick={() =>
                                                setShowLumpSumForm(false)
                                              }
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                          {updateFeePaymentMutation.isError &&
                                            updateFeePaymentMutation.error && (
                                              <p
                                                className="text-sm text-red-600"
                                                role="alert"
                                              >
                                                {getErrorMessage(
                                                  updateFeePaymentMutation.error,
                                                )}
                                              </p>
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {feeDetailQuery.data.fee.isInstallment &&
                                    feeDetailQuery.data.installments.length ===
                                      0 && (
                                      <p className="text-sm text-muted-foreground">
                                        No installment rows yet.
                                      </p>
                                    )}
                                  {feeDetailQuery.data.installments.length >
                                    0 && (
                                    <div className="overflow-x-auto rounded-lg border border-card-border bg-card shadow-md shadow-black/[0.06]">
                                      <table className="w-full min-w-[36rem] text-left text-sm">
                                        <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                                          <tr>
                                            <th className="px-4 py-2 font-medium">
                                              #
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                              Due
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                              Amount
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                              Paid
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                              Status
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                              Payment
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                          {feeDetailQuery.data.installments.map(
                                            (inst, idx) => (
                                              <Fragment key={inst.id}>
                                                <tr>
                                                  <td className="px-4 py-2 text-muted-foreground">
                                                    {idx + 1}
                                                  </td>
                                                  <td className="px-4 py-2 text-foreground">
                                                    {formatDate(inst.dueDate)}
                                                  </td>
                                                  <td className="px-4 py-2 text-right tabular-nums">
                                                    {formatMoney(inst.amount)}
                                                  </td>
                                                  <td className="px-4 py-2 text-right tabular-nums">
                                                    {formatMoney(
                                                      inst.paidAmount,
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-2">
                                                    <span
                                                      className={cn(
                                                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                                                        statusBadgeClass(
                                                          inst.status,
                                                        ),
                                                      )}
                                                    >
                                                      {inst.status}
                                                    </span>
                                                  </td>
                                                  <td className="px-4 py-2 text-right">
                                                    <button
                                                      type="button"
                                                      className="text-sm font-medium text-primary hover:underline"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openInstallmentPayment(
                                                          inst,
                                                        );
                                                      }}
                                                    >
                                                      Record
                                                    </button>
                                                  </td>
                                                </tr>
                                                {recordingInstallmentId ===
                                                  inst.id && (
                                                  <tr>
                                                    <td
                                                      colSpan={6}
                                                      className="px-4 py-4"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    >
                                                      <div className="mx-auto max-w-md space-y-3">
                                                        <p className="text-xs text-muted-foreground">
                                                          Enter total collected
                                                          for this installment
                                                          (max{" "}
                                                          {formatMoney(
                                                            inst.amount,
                                                          )}
                                                          ).
                                                        </p>
                                                        <Input
                                                          label="Amount recorded as paid"
                                                          type="number"
                                                          step="0.01"
                                                          min={0}
                                                          value={instPaidInput}
                                                          onChange={(e) =>
                                                            setInstPaidInput(
                                                              e.target.value,
                                                            )
                                                          }
                                                        />
                                                        <SelectField
                                                          label="Method"
                                                          name={`inst-method-${inst.id}`}
                                                          options={PAYMENT_METHOD_OPTIONS.map(
                                                            (o) => ({
                                                              value: o.value,
                                                              label: o.label,
                                                            }),
                                                          )}
                                                          value={instMethod}
                                                          onValueChange={(v) =>
                                                            setInstMethod(
                                                              v as ManualPaymentMethod,
                                                            )
                                                          }
                                                        />
                                                        <Input
                                                          label="Reference"
                                                          placeholder="Cheque no. / receipt"
                                                          required
                                                          value={instReference}
                                                          onChange={(e) =>
                                                            setInstReference(
                                                              e.target.value,
                                                            )
                                                          }
                                                        />
                                                        <div className="flex flex-wrap gap-2">
                                                          <Button
                                                            type="button"
                                                            disabled={
                                                              updateInstallmentMutation.isPending
                                                            }
                                                            onClick={() =>
                                                              void submitInstallmentPayment(
                                                                feeDetailQuery
                                                                  .data!.fee.id,
                                                                inst,
                                                              )
                                                            }
                                                          >
                                                            {updateInstallmentMutation.isPending
                                                              ? "Saving…"
                                                              : "Save"}
                                                          </Button>
                                                          <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() =>
                                                              setRecordingInstallmentId(
                                                                null,
                                                              )
                                                            }
                                                          >
                                                            Cancel
                                                          </Button>
                                                        </div>
                                                        {updateInstallmentMutation.isError &&
                                                          updateInstallmentMutation.error && (
                                                            <p
                                                              className="text-sm text-red-600"
                                                              role="alert"
                                                            >
                                                              {getErrorMessage(
                                                                updateInstallmentMutation.error,
                                                              )}
                                                            </p>
                                                          )}
                                                      </div>
                                                    </td>
                                                  </tr>
                                                )}
                                              </Fragment>
                                            ),
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {!feesQuery.isLoading && feesData && feePages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Page {feesData.page} of {feePages} · {feesData.total} fee
              {feesData.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={feePage <= 1}
                onClick={() => {
                  setExpandedFeeId(null);
                  setFeePage((p) => Math.max(1, p - 1));
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={feePage >= feePages}
                onClick={() => {
                  setExpandedFeeId(null);
                  setFeePage((p) => (p < feePages ? p + 1 : p));
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-0! overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <CardTitle className="text-lg">Parent / guardian</CardTitle>
          <CardDescription>
            Contact for fee reminders and follow-ups.
          </CardDescription>
        </div>
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Name
            </p>
            <p className="text-sm text-foreground">{student.parentName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone
            </p>
            <p className="font-mono text-sm text-foreground">
              {student.parentPhoneNumber}
            </p>
          </div>
        </div>
      </Card>

      <ConfirmationModal
        open={paymentValidationModal.open}
        onOpenChange={(open) =>
          setPaymentValidationModal((prev) => ({ ...prev, open }))
        }
        title={paymentValidationModal.title}
        description={paymentValidationModal.description}
        onConfirm={() =>
          setPaymentValidationModal((prev) => ({ ...prev, open: false }))
        }
        confirmLabel="OK"
        cancelLabel="Close"
      />
    </div>
  );
}
