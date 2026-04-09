import multer from "multer";

/** In-memory upload for Excel import (max 5 MB). */
export const uploadExcelMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const nameOk = /\.(xlsx|xls)$/i.test(file.originalname);
    const mimeOk =
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/octet-stream";
    if (nameOk || mimeOk) {
      cb(null, true);
      return;
    }
    cb(new Error("Upload an Excel file (.xlsx or .xls)"));
  },
});
