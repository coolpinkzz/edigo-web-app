import { Request, Response } from "express";
import * as courseService from "./course.service";
import {
  CreateCourseBody,
  ListCoursesQuery,
  UpdateCourseBody,
} from "./course.validation";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateCourseBody;
    const tenantId = req.user!.tenantId;

    const created = await courseService.createCourse(tenantId, {
      name: body.name,
      shortCode: body.shortCode,
      description: body.description,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });

    res.status(201).json(created);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create course";
    res.status(400).json({ error: message });
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListCoursesQuery;
  const tenantId = req.user!.tenantId;

  const result = await courseService.listCourses(tenantId, {
    page: q.page,
    limit: q.limit,
    includeInactive: q.includeInactive,
  });

  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { courseId } = req.params as { courseId: string };

  const row = await courseService.getCourseById(tenantId, courseId);
  if (!row) {
    res.status(404).json({ error: "Course not found" });
    return;
  }
  res.json(row);
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateCourseBody;
    const tenantId = req.user!.tenantId;
    const { courseId } = req.params as { courseId: string };

    const updated = await courseService.updateCourse(tenantId, courseId, body);
    if (!updated) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update course";
    res.status(400).json({ error: message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { courseId } = req.params as { courseId: string };

  const result = await courseService.deleteCourse(tenantId, courseId);
  if (result.ok) {
    res.status(204).send();
    return;
  }
  if (result.reason === "in_use") {
    res.status(400).json({
      error:
        "Cannot delete course while students are assigned; reassign or clear courseId first",
    });
    return;
  }
  res.status(404).json({ error: "Course not found" });
}
