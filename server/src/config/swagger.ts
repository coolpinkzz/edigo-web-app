import path from "path";
import swaggerJSDoc from "swagger-jsdoc";
import {
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
} from "../modules/student/student.model";

/**
 * OpenAPI definition shared by all documented endpoints.
 * Add servers, tags, components/schemas here as the API grows.
 */
const swaggerDefinition: swaggerJSDoc.OAS3Definition = {
  openapi: "3.0.0",
  info: {
    title: "Edigo API",
    version: "1.0.0",
    description: "API documentation for fee management system",
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Public", description: "Unauthenticated marketing and utilities" },
    { name: "Auth", description: "Signup, login, and session" },
    { name: "Students", description: "Student management" },
    { name: "Fees", description: "Fees and installments" },
    {
      name: "FeeTemplates",
      description: "Reusable fee blueprints and bulk assignment to students",
    },
    { name: "Payments", description: "Razorpay orders and webhooks" },
    {
      name: "Courses",
      description:
        "Tenant course catalog; student.courseId references a Course document id",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT from POST /auth/login (Authorization: Bearer <token>)",
      },
    },
    schemas: {
      AuthSuccess: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT access token" },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          phone: { type: "string", description: "E.164 phone number" },
          name: { type: "string" },
          tenantId: { type: "string" },
          tenantType: {
            type: "string",
            enum: ["SCHOOL", "ACADEMY"],
            description:
              "From tenant record; SCHOOL = class/section UI, ACADEMY = course-oriented UI",
          },
          role: {
            type: "string",
            enum: ["SUPER_ADMIN", "TENANT_ADMIN", "STAFF", "VIEWER"],
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                message: { type: "string" },
              },
            },
            description: "Present for Joi validation failures (400)",
          },
        },
      },
      Student: {
        type: "object",
        description:
          "Shape depends on tenant: SCHOOL uses class+section; ACADEMY uses courseId (+ optional `course` on GET). Null means not applicable.",
        properties: {
          id: { type: "string" },
          tenantId: { type: "string" },
          studentName: { type: "string" },
          admissionId: { type: "string" },
          scholarId: { type: "string" },
          parentName: { type: "string" },
          parentPhoneNumber: { type: "string" },
          alternatePhone: { type: "string" },
          parentEmail: { type: "string" },
          panNumber: { type: "string" },
          class: {
            type: "string",
            nullable: true,
            enum: [...STUDENT_CLASSES],
            description: "Set for school tenants",
          },
          section: {
            type: "string",
            nullable: true,
            enum: [...STUDENT_SECTIONS],
            description: "Set for school tenants",
          },
          courseId: {
            type: "string",
            nullable: true,
            pattern: "^[a-f0-9]{24}$",
            description: "Course catalog id; set for academy tenants",
          },
          course: {
            type: "object",
            description:
              "Present on GET when courseId is set and course exists",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE", "DROPPED"],
          },
          joinedAt: { type: "string", format: "date-time" },
          leftAt: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Course: {
        type: "object",
        properties: {
          id: { type: "string" },
          tenantId: { type: "string" },
          name: { type: "string" },
          shortCode: { type: "string" },
          description: { type: "string" },
          sortOrder: { type: "integer" },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CourseCreate: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", maxLength: 200 },
          shortCode: { type: "string", maxLength: 50 },
          description: { type: "string", maxLength: 2000 },
          sortOrder: { type: "integer", minimum: 0 },
          isActive: { type: "boolean" },
        },
      },
      CourseUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", maxLength: 200 },
          shortCode: { type: "string", maxLength: 50 },
          description: { type: "string", maxLength: 2000 },
          sortOrder: { type: "integer", minimum: 0 },
          isActive: { type: "boolean" },
        },
      },
      CourseListResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Course" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      StudentCreate: {
        type: "object",
        required: ["studentName", "parentName", "parentPhoneNumber"],
        description:
          "Tenant rules: SCHOOL requires class+section; ACADEMY requires courseId (see POST /auth/signup tenantType). Optional feeTemplateId assigns one fee from that template after the student is created (same behavior as POST /fees with source=TEMPLATE). If fee creation fails, the student row is not kept.",
        properties: {
          studentName: { type: "string" },
          admissionId: { type: "string" },
          scholarId: { type: "string" },
          parentName: { type: "string" },
          parentPhoneNumber: { type: "string" },
          alternatePhone: { type: "string" },
          parentEmail: { type: "string" },
          panNumber: { type: "string" },
          class: {
            type: "string",
            enum: [...STUDENT_CLASSES],
            description: "Required for SCHOOL tenants",
          },
          section: {
            type: "string",
            enum: [...STUDENT_SECTIONS],
            description: "Required for SCHOOL tenants",
          },
          courseId: {
            type: "string",
            pattern: "^[a-f0-9]{24}$",
            description: "Required for ACADEMY tenants (catalog id)",
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE", "DROPPED"],
          },
          joinedAt: { type: "string", format: "date-time" },
          leftAt: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
          feeTemplateId: {
            type: "string",
            pattern: "^[a-f0-9]{24}$",
            description:
              "Optional. Tenant fee template id; when set, creates one fee for the new student (STAFF+).",
          },
          assignmentAnchorDate: {
            type: "string",
            format: "date-time",
            description:
              "When feeTemplateId is set: anchor for installment due dates (IST); same as POST /fees",
          },
          feeOverrides: {
            $ref: "#/components/schemas/FeeTemplateAssignmentOverrides",
            description:
              "When feeTemplateId is set: optional field overrides on the instantiated fee",
          },
        },
      },
      StudentCreated: {
        description:
          "Created student. Includes feeFromTemplate when the request had feeTemplateId and fee creation succeeded.",
        allOf: [
          { $ref: "#/components/schemas/Student" },
          {
            type: "object",
            properties: {
              feeFromTemplate: {
                $ref: "#/components/schemas/Fee",
              },
            },
          },
        ],
      },
      StudentUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          studentName: { type: "string" },
          admissionId: { type: "string" },
          scholarId: { type: "string" },
          parentName: { type: "string" },
          parentPhoneNumber: { type: "string" },
          alternatePhone: { type: "string" },
          parentEmail: { type: "string" },
          panNumber: { type: "string" },
          class: { type: "string", enum: [...STUDENT_CLASSES] },
          section: { type: "string", enum: [...STUDENT_SECTIONS] },
          courseId: {
            type: "string",
            pattern: "^[a-f0-9]{24}$",
            description: "Optional Course id; omit or clear to unset",
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE", "DROPPED"],
          },
          joinedAt: { type: "string", format: "date-time" },
          leftAt: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      StudentListResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Student" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      Fee: {
        type: "object",
        properties: {
          id: { type: "string" },
          tenantId: { type: "string" },
          studentId: { type: "string" },
          source: {
            type: "string",
            enum: ["TEMPLATE", "CUSTOM"],
            description:
              "CUSTOM = manual create; TEMPLATE = copied from template at creation time",
          },
          templateId: {
            type: "string",
            description:
              "Set only when source is TEMPLATE (snapshot id; template document is not read afterward)",
          },
          title: { type: "string" },
          description: { type: "string" },
          feeType: {
            type: "string",
            enum: ["TUITION", "TRANSPORT", "HOSTEL", "OTHER"],
          },
          category: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          totalAmount: { type: "number" },
          paidAmount: { type: "number" },
          pendingAmount: { type: "number" },
          isInstallment: { type: "boolean" },
          status: {
            type: "string",
            enum: ["PENDING", "PARTIAL", "PAID", "OVERDUE"],
          },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Installment: {
        type: "object",
        properties: {
          id: { type: "string" },
          feeId: { type: "string" },
          amount: { type: "number" },
          paidAmount: { type: "number" },
          dueDate: { type: "string", format: "date-time" },
          status: {
            type: "string",
            enum: ["PENDING", "PARTIAL", "PAID", "OVERDUE"],
          },
          lateFee: { type: "number" },
          discount: { type: "number" },
          metadata: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      FeeCreate: {
        type: "object",
        required: ["source", "studentId"],
        description:
          "Use source=CUSTOM with title, feeType, totalAmount, etc. or source=TEMPLATE with templateId and optional feeOverrides.",
        properties: {
          source: { type: "string", enum: ["CUSTOM", "TEMPLATE"] },
          studentId: { type: "string" },
          templateId: {
            type: "string",
            description: "Required when source is TEMPLATE",
          },
          assignmentAnchorDate: {
            type: "string",
            format: "date-time",
            description: "For TEMPLATE: anchor for installment dueInDays (IST)",
          },
          feeOverrides: {
            $ref: "#/components/schemas/FeeTemplateAssignmentOverrides",
          },
          title: { type: "string" },
          description: { type: "string" },
          feeType: {
            type: "string",
            enum: ["TUITION", "TRANSPORT", "HOSTEL", "OTHER"],
          },
          category: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          totalAmount: { type: "number" },
          paidAmount: { type: "number" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      FeeUpdate: {
        type: "object",
        minProperties: 1,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          feeType: {
            type: "string",
            enum: ["TUITION", "TRANSPORT", "HOSTEL", "OTHER"],
          },
          category: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          totalAmount: { type: "number" },
          paidAmount: { type: "number" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      AddInstallmentsBody: {
        type: "object",
        required: ["installments"],
        properties: {
          installments: {
            type: "array",
            items: {
              type: "object",
              required: ["amount", "dueDate"],
              properties: {
                amount: { type: "number" },
                dueDate: { type: "string", format: "date-time" },
                paidAmount: { type: "number" },
                lateFee: { type: "number" },
                discount: { type: "number" },
                metadata: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
      FeeListResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Fee" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      FeeWithInstallments: {
        type: "object",
        properties: {
          fee: { $ref: "#/components/schemas/Fee" },
          installments: {
            type: "array",
            items: { $ref: "#/components/schemas/Installment" },
          },
        },
      },
      FeeTemplate: {
        type: "object",
        properties: {
          id: { type: "string" },
          tenantId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          feeType: {
            type: "string",
            enum: ["TUITION", "TRANSPORT", "HOSTEL", "OTHER"],
          },
          category: { type: "string" },
          totalAmount: { type: "number" },
          isInstallment: { type: "boolean" },
          defaultInstallments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                amount: { type: "number" },
                dueInDays: { type: "integer", minimum: 0 },
                lateFee: { type: "number" },
                discount: { type: "number" },
                metadata: { type: "object", additionalProperties: true },
              },
            },
          },
          installmentAnchorDate: {
            type: "string",
            description: "YYYY-MM-DD; installment templates",
          },
          defaultEndDate: {
            type: "string",
            description:
              "YYYY-MM-DD; lump-sum templates — default due date on instantiated fees",
          },
          metadata: { type: "object", additionalProperties: true },
          tags: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      FeeTemplateCreate: {
        type: "object",
        required: ["title", "feeType", "totalAmount", "isInstallment"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          feeType: {
            type: "string",
            enum: ["TUITION", "TRANSPORT", "HOSTEL", "OTHER"],
          },
          category: { type: "string" },
          totalAmount: { type: "number" },
          isInstallment: { type: "boolean" },
          defaultInstallments: {
            type: "array",
            items: {
              type: "object",
              required: ["amount", "dueInDays"],
              properties: {
                amount: { type: "number" },
                dueInDays: { type: "integer", minimum: 0 },
                lateFee: { type: "number" },
                discount: { type: "number" },
                metadata: { type: "object", additionalProperties: true },
              },
            },
          },
          installmentAnchorDate: {
            type: "string",
            description: "YYYY-MM-DD; required when isInstallment is true",
          },
          defaultEndDate: {
            type: "string",
            description:
              "YYYY-MM-DD; when isInstallment is false — default due date on new fees",
          },
          metadata: { type: "object", additionalProperties: true },
          tags: { type: "array", items: { type: "string" } },
        },
      },
      FeeTemplateAssign: {
        type: "object",
        description:
          "Exactly one targeting mode: either studentIds (explicit) OR class (optional section to narrow).",
        properties: {
          studentIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 500,
            description:
              "Explicit student ObjectIds (mutually exclusive with class)",
          },
          class: {
            type: "string",
            enum: [...STUDENT_CLASSES],
            description:
              "Assign to all students in this grade (mutually exclusive with studentIds)",
          },
          section: {
            type: "string",
            enum: [...STUDENT_SECTIONS],
            description: "Optional; only with class — restrict to section A–D",
          },
          assignmentAnchorDate: {
            type: "string",
            format: "date-time",
            description:
              "Defaults to now; installment due dates = anchor + dueInDays (IST calendar)",
          },
          feeOverrides: {
            $ref: "#/components/schemas/FeeTemplateAssignmentOverrides",
          },
          perStudentOverrides: {
            type: "object",
            additionalProperties: {
              $ref: "#/components/schemas/FeeTemplateAssignmentOverrides",
            },
          },
        },
      },
      FeeTemplateAssignmentOverrides: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          tags: { type: "array", items: { type: "string" } },
          discount: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "Principal discount percentage (0-100) applied to template totalAmount for this assignment snapshot",
          },
        },
      },
      FeeTemplateAssignResult: {
        type: "object",
        properties: {
          assignedCount: {
            type: "integer",
            description:
              "New fees created (students that did not already have this template)",
          },
          skippedDuplicateCount: {
            type: "integer",
            description:
              "Students skipped because a TEMPLATE fee for this template already exists",
          },
        },
      },
      FeeTemplateListResponse: {
        type: "object",
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/FeeTemplate" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  },
};

/**
 * Paths to route files containing @openapi JSDoc blocks.
 * - `.ts` paths: used when running with tsx (e.g. `npm run dev`).
 * - `.js` paths: used after `npm run build` when running `node dist/index.js`.
 */
const routeGlobs = [
  path.join(__dirname, "../routes/*.ts"),
  path.join(__dirname, "../routes/*.js"),
];

const swaggerOptions: swaggerJSDoc.OAS3Options = {
  definition: swaggerDefinition,
  apis: routeGlobs,
};

/**
 * Parsed OpenAPI document for Swagger UI and tooling.
 */
export const swaggerSpec = swaggerJSDoc(swaggerOptions);
