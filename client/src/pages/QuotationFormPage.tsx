import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input } from "../components/ui";
import { useBranches } from "../hooks/useBranches";
import { useCourses } from "../hooks/useCourses";
import { useQuotation } from "../hooks/useQuotation";
import { useCreateQuotation } from "../hooks/useCreateQuotation";
import { useUpdateQuotation } from "../hooks/useUpdateQuotation";
import { useAuthSession } from "../hooks/useAuthSession";
import { useFeeTemplates } from "../hooks/useFeeTemplates";
import {
  STUDENT_CLASS_OPTIONS,
  STUDENT_GENDER_OPTIONS,
  STUDENT_SECTION_OPTIONS,
} from "../types/student.types";
import { getErrorMessage } from "../utils";
import { cn } from "../utils/cn";
import type { CreateQuotationPayload } from "../types/quotation.types";

type FormState = {
  name: string;
  parentName: string;
  gender: string;
  age: string;
  phone: string;
  address: string;
  email: string;
  branchId: string;
  discountPercent: string;
  websiteUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  feeTemplateId: string;
  validUntil: string;
  preferredTimeSlot: string;
  quotationOverview: string;
  notes: string;
  courseId: string;
  schoolClass: string;
  schoolSection: string;
};

const emptyForm: FormState = {
  name: "",
  parentName: "",
  gender: "MALE",
  age: "",
  phone: "",
  address: "",
  email: "",
  branchId: "",
  discountPercent: "0",
  websiteUrl: "",
  youtubeUrl: "",
  instagramUrl: "",
  feeTemplateId: "",
  validUntil: "",
  preferredTimeSlot: "",
  quotationOverview: "",
  notes: "",
  courseId: "",
  schoolClass: "",
  schoolSection: "",
};

export function QuotationFormPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const isEdit = Boolean(quotationId);
  const navigate = useNavigate();
  const sessionQuery = useAuthSession();
  const tenantType = sessionQuery.data?.tenant?.tenantType;
  const isAcademy = tenantType === "ACADEMY";
  const branchesQuery = useBranches();
  const templatesQuery = useFeeTemplates({ limit: 100 });
  const coursesQuery = useCourses({ limit: 100 }, { enabled: isAcademy });
  const existingQuery = useQuotation(isEdit ? quotationId : undefined);

  const createMut = useCreateQuotation();
  const updateMut = useUpdateQuotation();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [initialized, setInitialized] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || !existingQuery.data) return;
    const q = existingQuery.data;
    setForm({
      name: q.name,
      parentName: q.parentName,
      gender: q.gender,
      age: String(q.age),
      phone: q.phone,
      address: q.address,
      email: q.email ?? "",
      branchId: q.branchId,
      discountPercent: String(q.discountPercent),
      websiteUrl: q.websiteUrl ?? "",
      youtubeUrl: q.youtubeUrl ?? "",
      instagramUrl: q.instagramUrl ?? "",
      feeTemplateId: q.feeTemplateId,
      validUntil: q.validUntil.slice(0, 10),
      preferredTimeSlot: q.preferredTimeSlot,
      quotationOverview: q.quotationOverview ?? "",
      notes: q.notes ?? "",
      courseId: q.courseId ?? "",
      schoolClass: q.schoolClass ?? "",
      schoolSection: q.schoolSection ?? "",
    });
    setInitialized(true);
  }, [isEdit, existingQuery.data]);

  useEffect(() => {
    if (isEdit || initialized) return;
    const list = branchesQuery.data;
    if (list?.length === 1) {
      setForm((f) => ({ ...f, branchId: list[0]!.id }));
      setInitialized(true);
    }
  }, [isEdit, initialized, branchesQuery.data]);

  function buildPayload(): CreateQuotationPayload {
    const age = parseInt(form.age, 10);
    if (!Number.isFinite(age)) {
      throw new Error("Age must be a number");
    }
    const discountPercent = parseFloat(form.discountPercent);
    if (!Number.isFinite(discountPercent)) {
      throw new Error("Discount must be a number");
    }
    const body: CreateQuotationPayload = {
      name: form.name.trim(),
      parentName: form.parentName.trim(),
      gender: form.gender as CreateQuotationPayload["gender"],
      age,
      phone: form.phone.trim(),
      address: form.address.trim(),
      branchId: form.branchId.trim(),
      discountPercent,
      feeTemplateId: form.feeTemplateId.trim(),
      validUntil: new Date(`${form.validUntil}T12:00:00`).toISOString(),
      preferredTimeSlot: form.preferredTimeSlot.trim(),
    };
    if (form.email.trim()) body.email = form.email.trim();
    if (form.websiteUrl.trim()) body.websiteUrl = form.websiteUrl.trim();
    if (form.youtubeUrl.trim()) body.youtubeUrl = form.youtubeUrl.trim();
    if (form.instagramUrl.trim()) body.instagramUrl = form.instagramUrl.trim();
    if (form.quotationOverview.trim()) {
      body.quotationOverview = form.quotationOverview.trim();
    }
    if (form.notes.trim()) body.notes = form.notes.trim();
    if (isAcademy) {
      if (!form.courseId.trim()) throw new Error("Select a course");
      body.courseId = form.courseId.trim();
    } else {
      if (!form.schoolClass.trim() || !form.schoolSection.trim()) {
        throw new Error("Select class and section");
      }
      body.class = form.schoolClass.trim();
      body.section = form.schoolSection.trim();
    }
    return body;
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    try {
      const payload = buildPayload();
      if (isEdit && quotationId) {
        updateMut.mutate(
          { id: quotationId, body: payload },
          {
            onSuccess: (row) => {
              navigate(`/quotations/${row.id}`, { replace: true });
            },
          },
        );
      } else {
        createMut.mutate(payload, {
          onSuccess: (row) => {
            navigate(`/quotations/${row.id}`, { replace: true });
          },
        });
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Invalid form");
    }
  }

  const saving = createMut.isPending || updateMut.isPending;
  const error = createMut.error ?? updateMut.error;

  if (isEdit && existingQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isEdit && existingQuery.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {getErrorMessage(existingQuery.error)}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          {isEdit ? "Edit quotation" : "New quotation"}
        </h1>
        <Link to={isEdit && quotationId ? `/quotations/${quotationId}` : "/quotations"}>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </Link>
      </div>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">
              Quotation intro / overview (optional, PDF)
            </label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Shown on the generated PDF after the date block and before course
              and fee. Use for a short welcome, batch highlights, or terms.
            </p>
            <textarea
              name="quotationOverview"
              rows={4}
              className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={form.quotationOverview}
              onChange={(e) =>
                setForm((f) => ({ ...f, quotationOverview: e.target.value }))
              }
            />
          </div>

          <Input
            label="Student / applicant name"
            name="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Parent name"
            name="parentName"
            value={form.parentName}
            onChange={(e) =>
              setForm((f) => ({ ...f, parentName: e.target.value }))
            }
            required
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">
              Gender
            </label>
            <select
              className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value }))
              }
            >
              {STUDENT_GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Age"
            name="age"
            type="number"
            min={3}
            max={100}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
            required
          />
          <Input
            label="Phone (10 digits)"
            name="phone"
            inputMode="numeric"
            maxLength={10}
            value={form.phone}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10),
              }))
            }
            required
          />
          <Input
            label="Email (optional)"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">
              Address
            </label>
            <textarea
              name="address"
              required
              rows={3}
              className={cn(
                "block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
              )}
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">
              Branch
            </label>
            <select
              className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={form.branchId}
              onChange={(e) =>
                setForm((f) => ({ ...f, branchId: e.target.value }))
              }
              required
            >
              <option value="">Select branch</option>
              {(branchesQuery.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {isAcademy && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                Course
              </label>
              <select
                className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                value={form.courseId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, courseId: e.target.value }))
                }
                required
              >
                <option value="">Select course</option>
                {(coursesQuery.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isAcademy && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                  Class
                </label>
                <select
                  className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  value={form.schoolClass}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, schoolClass: e.target.value }))
                  }
                  required
                >
                  <option value="">Select class</option>
                  {STUDENT_CLASS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground/80">
                  Section
                </label>
                <select
                  className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                  value={form.schoolSection}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, schoolSection: e.target.value }))
                  }
                  required
                >
                  <option value="">Select section</option>
                  {STUDENT_SECTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">
              Fee structure
            </label>
            <select
              className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={form.feeTemplateId}
              onChange={(e) =>
                setForm((f) => ({ ...f, feeTemplateId: e.target.value }))
              }
              required
            >
              <option value="">Select fee structure</option>
              {(templatesQuery.data?.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} — Rs{" "}
                  {t.totalAmount.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Discount % applies to this structure&apos;s total.
            </p>
          </div>

          <Input
            label="Discount (%)"
            name="discountPercent"
            type="number"
            min={0}
            max={100}
            step={0.01}
            hideNumberSpinners
            value={form.discountPercent}
            onChange={(e) =>
              setForm((f) => ({ ...f, discountPercent: e.target.value }))
            }
            required
          />

          <Input
            label="Quotation valid until"
            name="validUntil"
            type="date"
            value={form.validUntil}
            onChange={(e) =>
              setForm((f) => ({ ...f, validUntil: e.target.value }))
            }
            required
          />
          <Input
            label="Preferred class / visit time"
            name="preferredTimeSlot"
            placeholder="e.g. Evening batch 6–8pm"
            value={form.preferredTimeSlot}
            onChange={(e) =>
              setForm((f) => ({ ...f, preferredTimeSlot: e.target.value }))
            }
            required
          />

          <Input
            label="Website (optional)"
            name="websiteUrl"
            type="url"
            value={form.websiteUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, websiteUrl: e.target.value }))
            }
          />
          <Input
            label="YouTube (optional)"
            name="youtubeUrl"
            type="url"
            value={form.youtubeUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, youtubeUrl: e.target.value }))
            }
          />
          <Input
            label="Instagram (optional)"
            name="instagramUrl"
            type="url"
            value={form.instagramUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, instagramUrl: e.target.value }))
            }
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">
              Notes (PDF remarks)
            </label>
            <textarea
              name="notes"
              rows={3}
              className="block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {getErrorMessage(error)}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
