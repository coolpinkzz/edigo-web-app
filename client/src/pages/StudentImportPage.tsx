import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { confirmStudentImport, validateStudentImport } from '../api/student.api'
import { Button, Card, CardDescription, CardTitle } from '../components/ui'
import { useAuthSession } from '../hooks/useAuthSession'
import type {
  StudentImportInvalidRow,
  StudentImportValidRow,
  ValidateStudentImportResponse,
} from '../types'
import { getErrorMessage } from '../utils'

type PreviewRow =
  | { kind: 'valid'; row: StudentImportValidRow }
  | {
      kind: 'invalid'
      rowIndex: number
      row: Record<string, string>
      errors: string[]
    }

function buildPreviewRows(result: ValidateStudentImportResponse): PreviewRow[] {
  const rows: PreviewRow[] = [
    ...result.validRows.map((row) => ({ kind: 'valid' as const, row })),
    ...result.invalidRows.map((ir: StudentImportInvalidRow) => ({
      kind: 'invalid' as const,
      rowIndex: ir.rowIndex,
      row: ir.row,
      errors: ir.errors,
    })),
  ]
  rows.sort((a, b) => {
    const ai = a.kind === 'valid' ? a.row.rowIndex : a.rowIndex
    const bi = b.kind === 'valid' ? b.row.rowIndex : b.rowIndex
    return ai - bi
  })
  return rows
}

/**
 * Upload Excel → validate on server → preview → confirm bulk insert.
 */
export function StudentImportPage() {
  const sessionQuery = useAuthSession()
  const isAcademy = sessionQuery.data?.tenant?.tenantType === 'ACADEMY'

  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileLabel, setFileLabel] = useState('')
  const [result, setResult] = useState<ValidateStudentImportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | null) => {
    if (!file) return
    setError(null)
    setResult(null)
    setFileLabel(file.name)
    setLoading(true)
    try {
      const data = await validateStudentImport(file)
      setResult(data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const previewRows = result ? buildPreviewRows(result) : []
  const validCount = result?.validRows.length ?? 0
  const invalidCount = result?.invalidRows.length ?? 0

  const handleConfirm = async () => {
    if (!result?.validRows.length) return
    setError(null)
    setConfirming(true)
    try {
      const { inserted } = await confirmStudentImport(result.validRows)
      navigate(`/students?imported=${inserted}`)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setConfirming(false)
    }
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isAcademy) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Import students
            </h1>
            <p className="text-sm text-muted-foreground">
              Bulk Excel import is available for school organizations only.
            </p>
          </div>
          <Link
            to="/students"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to students
          </Link>
        </div>
        <Card className="p-6">
          <CardTitle className="text-lg">Use Add student instead</CardTitle>
          <CardDescription className="mb-4 max-w-xl">
            Academy organizations use courses instead of class and section. Add
            students individually and assign a course from your catalog.
          </CardDescription>
          <div className="flex flex-wrap gap-3">
            <Link to="/students/new">
              <Button type="button">Add student</Button>
            </Link>
            <Link to="/courses">
              <Button type="button" variant="secondary">
                Manage courses
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Import students</h1>
          <p className="text-sm text-muted-foreground">
            Upload an Excel file with columns: studentName, scholarId, parentName,
            parentPhoneNumber, PAN, class, section.
          </p>
        </div>
        <Link to="/students" className="text-sm font-medium text-primary hover:underline">
          Back to students
        </Link>
      </div>

      <Card className="p-6">
        <CardTitle className="text-lg">1. Upload file</CardTitle>
        <CardDescription className="mb-4">
          Use .xlsx or .xls. First row must be headers. Class must match app values (e.g. 10th,
          Nursery). Section is A–D.
        </CardDescription>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            void handleFile(f ?? null)
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? 'Validating…' : 'Choose Excel file'}
          </Button>
          {fileLabel ? (
            <span className="text-sm text-muted-foreground">{fileLabel}</span>
          ) : null}
        </div>
      </Card>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      {result && (
        <Card className="overflow-hidden p-0!">
          <div className="border-b border-border px-6 py-4">
            <CardTitle className="text-lg">2. Preview</CardTitle>
            <CardDescription>
              <span className="text-emerald-700">{validCount} valid</span>
              {' · '}
              <span className={invalidCount > 0 ? 'text-red-700' : 'text-muted-foreground'}>
                {invalidCount} invalid
              </span>
            </CardDescription>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Row</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Scholar ID</th>
                  <th className="px-4 py-3 font-medium">Parent</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">PAN</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Sec.</th>
                  <th className="px-4 py-3 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {previewRows.map((pr) => {
                  if (pr.kind === 'valid') {
                    const r = pr.row
                    return (
                      <tr key={`v-${r.rowIndex}`} className="bg-emerald-50/50">
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">
                          {r.rowIndex}
                        </td>
                        <td className="px-4 py-2 font-medium">{r.studentName}</td>
                        <td className="px-4 py-2">{r.scholarId}</td>
                        <td className="px-4 py-2">{r.parentName}</td>
                        <td className="px-4 py-2 tabular-nums">{r.parentPhoneNumber}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.panNumber}</td>
                        <td className="px-4 py-2">{r.class}</td>
                        <td className="px-4 py-2">{r.section}</td>
                        <td className="px-4 py-2 text-emerald-800">—</td>
                      </tr>
                    )
                  }
                  const r = pr.row
                  return (
                    <tr key={`i-${pr.rowIndex}`} className="bg-red-50/80">
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">
                        {pr.rowIndex}
                      </td>
                      <td className="px-4 py-2">{r.studentName ?? ''}</td>
                      <td className="px-4 py-2">{r.scholarId ?? ''}</td>
                      <td className="px-4 py-2">{r.parentName ?? ''}</td>
                      <td className="px-4 py-2 tabular-nums">{r.parentPhoneNumber ?? ''}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.panNumber ?? ''}</td>
                      <td className="px-4 py-2">{r.class ?? ''}</td>
                      <td className="px-4 py-2">{r.section ?? ''}</td>
                      <td className="px-4 py-2 text-red-800">
                        <ul className="list-inside list-disc space-y-0.5">
                          {pr.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Only valid rows are imported. Fix invalid rows in the sheet and upload again if
              needed.
            </p>
            <Button
              type="button"
              disabled={validCount === 0 || confirming}
              onClick={() => void handleConfirm()}
            >
              {confirming ? 'Importing…' : `Confirm import (${validCount})`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
