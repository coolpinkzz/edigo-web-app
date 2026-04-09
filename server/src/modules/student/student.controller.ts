import { Request, Response } from "express";
import * as studentService from "./student.service";
import {
  ConfirmStudentImportBody,
  CreateStudentBody,
  FeeOverviewQuery,
  ListStudentsQuery,
  UpdateStudentBody,
} from "./student.validation";
import {
  listStudentFeeOverview,
  parseFeeStatusList,
  parseFeeTypeList,
} from "./student-fee-overview.service";
import {
  confirmImport,
  parseImportExcel,
  validateImportRows,
} from "./student-import.service";

/**
 * HTTP handlers for students. Input is already validated by Joi in `routes/student.routes.ts`
 * via `validate(...)`; only domain checks (e.g. merge invariants on PATCH) remain here.
 */

/**
 * POST /students/import/validate
 */
export async function importValidate(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res
        .status(400)
        .json({ error: "Excel file is required (form field: file)" });
      return;
    }
    const tenantId = req.user!.tenantId;
    const parsed = parseImportExcel(file.buffer);
    const result = await validateImportRows(tenantId, parsed);
    res.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to validate import file";
    res.status(400).json({ error: message });
  }
}

/**
 * POST /students/import/confirm
 */
export async function importConfirm(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as ConfirmStudentImportBody;
    const tenantId = req.user!.tenantId;
    const result = await confirmImport(tenantId, body.validRows);
    res.status(201).json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to import students";
    res.status(400).json({ error: message });
  }
}

/**
 * POST /students
 */
export async function create(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateStudentBody;
    const tenantId = req.user!.tenantId;
    const student = body.student ?? body;
    const feeAssignment = body.feeAssignment;

    const created = await studentService.createStudent(tenantId, {
      studentName: student.studentName,
      admissionId: student.admissionId,
      scholarId: student.scholarId,
      parentName: student.parentName,
      parentPhoneNumber: student.parentPhoneNumber,
      alternatePhone: student.alternatePhone,
      parentEmail: student.parentEmail,
      panNumber: student.panNumber,
      class: student.class,
      section: student.section,
      courseId: student.courseId,
      status: student.status,
      joinedAt: student.joinedAt,
      leftAt: student.leftAt,
      tags: student.tags,
      feeTemplateId: feeAssignment?.templateId ?? body.feeTemplateId,
      assignmentAnchorDate:
        feeAssignment?.assignmentAnchorDate ?? body.assignmentAnchorDate,
      feeOverrides: feeAssignment?.feeOverrides ?? body.feeOverrides,
      useCustomInstallments: feeAssignment?.useCustomInstallments,
      customInstallments: feeAssignment?.customInstallments,
    });

    res.status(201).json(created);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create student";
    res.status(400).json({ error: message });
  }
}

/**
 * GET /students
 */
export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListStudentsQuery;
  const tenantId = req.user!.tenantId;

  const result = await studentService.listStudents(tenantId, {
    page: q.page,
    limit: q.limit,
    status: q.status,
    class: q.class,
    section: q.section,
    search: q.search,
  });

  res.json(result);
}

/**
 * GET /students/fee-overview
 */
export async function feeOverview(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as FeeOverviewQuery;
  const tenantId = req.user!.tenantId;

  const feeStatuses = parseFeeStatusList(q.feeStatuses);
  if (feeStatuses === null) {
    res.status(400).json({ error: "Invalid feeStatuses" });
    return;
  }
  const feeTypes = parseFeeTypeList(q.feeTypes);
  if (feeTypes === null) {
    res.status(400).json({ error: "Invalid feeTypes" });
    return;
  }

  const result = await listStudentFeeOverview(tenantId, {
    page: q.page,
    limit: q.limit,
    studentStatus: q.studentStatus,
    class: q.class,
    section: q.section,
    search: q.search,
    feeStatuses,
    feeTypes,
    sortBy: q.sortBy,
    sortDir: q.sortDir,
  });
  res.json(result);
}

/**
 * GET /students/:id
 */
export async function getById(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const student = await studentService.getStudentById(tenantId, req.params.id);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(student);
}

/**
 * PATCH /students/:id
 */
export async function update(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateStudentBody;
    const patch: studentService.UpdateStudentInput = { ...body };

    const requiredAfterPatch = [
      "studentName",
      "parentName",
      "parentPhoneNumber",
    ] as const;
    const tenantId = req.user!.tenantId;
    const existing = await studentService.getStudentById(
      tenantId,
      req.params.id,
    );
    if (!existing) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    const merged = { ...existing, ...patch };
    const invalidRequired = requiredAfterPatch.some((k) => {
      const v = merged[k];
      return (
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "")
      );
    });
    if (invalidRequired) {
      res.status(400).json({
        error:
          "Update would leave required fields empty: studentName, parentName, parentPhoneNumber",
      });
      return;
    }

    const updated = await studentService.updateStudent(
      tenantId,
      req.params.id,
      patch,
    );
    if (!updated) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update student";
    res.status(400).json({ error: message });
  }
}

/**
 * DELETE /students/:id
 */
export async function remove(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const deleted = await studentService.deleteStudent(tenantId, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.status(204).send();
}
