'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Modal } from '@/shared/components/ui';
import {
  useExecuteImport,
  useImportJobStatus,
  useParseCsv,
  useValidateCsv,
} from '../hooks/useCsvImport';
import type {
  CsvImportMode,
  CsvImportResult,
  CsvParseResult,
  CsvValidationResult,
} from '../types';
import { downloadErrorReport, downloadSampleTemplate } from '../utils/csvExport';

const AVAILABLE_TARGET_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'title', label: 'Title', required: true },
  { key: 'type', label: 'Work Item Type', required: true },
  { key: 'state', label: 'State / Status' },
  { key: 'description', label: 'Description' },
  { key: 'assignedTo', label: 'Assignee (Email or Name)' },
  { key: 'area', label: 'Area Path' },
  { key: 'iteration', label: 'Iteration / Sprint' },
  { key: 'parent', label: 'Parent Item (ID, Seq #, or Title)' },
  { key: 'points', label: 'Story Points' },
  { key: 'priority', label: 'Priority (LOW, MEDIUM, HIGH, URGENT)' },
  { key: 'severity', label: 'Severity (LOW, MEDIUM, HIGH, CRITICAL)' },
  { key: 'remainingWork', label: 'Remaining Work' },
  { key: 'completedWork', label: 'Completed Work' },
  { key: 'startDate', label: 'Start Date (YYYY-MM-DD)' },
  { key: 'targetDate', label: 'Target Date (YYYY-MM-DD)' },
  { key: 'tags', label: 'Tags (Comma-separated)' },
];

export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onImportComplete?: () => void;
}

export function CsvImportModal({
  isOpen,
  onClose,
  projectId,
  onImportComplete,
}: CsvImportModalProps) {
  // Steps: 1: 'UPLOAD' | 2: 'MAPPING' | 3: 'PREVIEW' | 4: 'PROGRESS'
  const [step, setStep] = useState<'UPLOAD' | 'MAPPING' | 'PREVIEW' | 'PROGRESS'>('UPLOAD');

  // File & Parsing state
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);

  // Mapping state: CSV Header -> Target Field Key
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Validation state
  const [validationResult, setValidationResult] = useState<CsvValidationResult | null>(null);
  const [previewTab, setPreviewTab] = useState<'VALID' | 'ERRORS'>('VALID');
  const [importMode, setImportMode] = useState<CsvImportMode>('ALL_OR_NOTHING');

  // Execution & Progress state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<CsvImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const parseMutation = useParseCsv(projectId);
  const validateMutation = useValidateCsv(projectId);
  const executeMutation = useExecuteImport(projectId);

  // Job Polling
  const { data: jobData } = useImportJobStatus(activeJobId, step === 'PROGRESS');

  const handleReset = () => {
    setStep('UPLOAD');
    setFile(null);
    setParseResult(null);
    setMapping({});
    setValidationResult(null);
    setActiveJobId(null);
    setSyncResult(null);
  };

  const handleModalClose = () => {
    handleReset();
    onClose();
  };

  // ── Step 1: Upload & Parse ───────────────────────────────────────────────
  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);

    try {
      const parsed = await parseMutation.mutateAsync(selectedFile);
      setParseResult(parsed);
      setMapping(parsed.suggestedMapping || {});
      setStep('MAPPING');
    } catch {
      // Error handled by mutation state
    }
  };

  // ── Step 2: Mapping -> Validate ──────────────────────────────────────────
  const handleProceedToValidate = async () => {
    if (!parseResult) return;

    try {
      const validated = await validateMutation.mutateAsync({
        rows: parseResult.rows,
        mapping,
      });
      setValidationResult(validated);
      setPreviewTab(validated.invalidCount > 0 ? 'ERRORS' : 'VALID');
      setStep('PREVIEW');
    } catch {
      // Error handled by mutation state
    }
  };

  // ── Step 3: Confirm & Execute ────────────────────────────────────────────
  const handleConfirmImport = async () => {
    if (!parseResult) return;

    try {
      setStep('PROGRESS');
      const result = await executeMutation.mutateAsync({
        rows: parseResult.rows,
        mapping,
        mode: importMode,
      });

      if (result.isAsync && result.jobId) {
        setActiveJobId(result.jobId);
      } else {
        setSyncResult(result);
        onImportComplete?.();
      }
    } catch {
      // Error handled by mutation state
    }
  };

  // Compute Job Status
  const job = jobData?.job;
  const isJobComplete = job?.status === 'COMPLETED';
  const isJobFailed = job?.status === 'FAILED' || job?.status === 'DEAD_LETTER';
  const jobProgress = job ? job.progress : syncResult ? 100 : 0;
  const jobResult = job?.result;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Import Work Items from CSV"
    >
      <div className="w-full flex flex-col space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 text-xs">
          <div
            className={`font-semibold flex items-center gap-1.5 ${
              step === 'UPLOAD'
                ? 'text-[var(--brand-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Upload</span>
          </div>

          <div
            className={`font-semibold flex items-center gap-1.5 ${
              step === 'MAPPING'
                ? 'text-[var(--brand-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Map Fields</span>
          </div>

          <div
            className={`font-semibold flex items-center gap-1.5 ${
              step === 'PREVIEW'
                ? 'text-[var(--brand-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              3
            </span>
            <span>Validate & Preview</span>
          </div>

          <div
            className={`font-semibold flex items-center gap-1.5 ${
              step === 'PROGRESS'
                ? 'text-[var(--brand-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">
              4
            </span>
            <span>Complete</span>
          </div>
        </div>

        {/* ── STEP 1: UPLOAD ── */}
        {step === 'UPLOAD' && (
          <div className="space-y-6">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile && droppedFile.name.endsWith('.csv')) {
                  handleFileChange(droppedFile);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--brand-primary)] bg-[var(--bg-surface-hover)]/20 hover:bg-[var(--bg-surface-hover)]/50 rounded-[var(--radius-card)] p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) handleFileChange(selected);
                }}
              />
              <div className="h-12 w-12 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Choose a CSV file or drag & drop here
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
                Upload your work items spreadsheet. Commas, semicolons, and quotes are supported.
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-[var(--radius-button)] shadow-xs"
              >
                Browse Files
              </button>
            </div>

            {parseMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-[var(--text-secondary)]">
                <RefreshCw className="h-4 w-4 animate-spin text-[var(--brand-primary)]" />
                <span>Reading and parsing CSV structure...</span>
              </div>
            )}

            {parseMutation.isError && (
              <div className="rounded-[var(--radius-button)] border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{(parseMutation.error as any)?.message || 'Failed to parse CSV file'}</span>
              </div>
            )}

            {/* Template Download Helper */}
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]/30 border border-[var(--border-subtle)] text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-[var(--brand-primary)]" />
                <span className="text-[var(--text-secondary)]">
                  Need an example format with standard columns?
                </span>
              </div>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)] hover:underline cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: MAPPING ── */}
        {step === 'MAPPING' && parseResult && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Found {parseResult.totalRows} data rows across {parseResult.headers.length} columns
              </span>
              <span className="text-[var(--text-muted)]">
                Match each column to its corresponding Worklane field.
              </span>
            </div>

            <div className="max-h-[50vh] overflow-y-auto border border-[var(--border-subtle)] rounded-[var(--radius-card)] divide-y divide-[var(--border-subtle)]">
              {parseResult.headers.map((header) => {
                const sampleValues = parseResult.sampleRows
                  .map((r) => r[header])
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(', ');

                return (
                  <div key={header} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[var(--bg-surface)]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">{header}</span>
                        {mapping[header] && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Mapped
                          </span>
                        )}
                      </div>
                      {sampleValues && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                          Samples: {sampleValues}
                        </p>
                      )}
                    </div>

                    <div className="w-full sm:w-64 shrink-0">
                      <select
                        value={mapping[header] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMapping((prev) => {
                            const next = { ...prev };
                            if (val) {
                              next[header] = val;
                            } else {
                              delete next[header];
                            }
                            return next;
                          });
                        }}
                        className="w-full rounded-[var(--radius-button)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-hidden"
                      >
                        <option value="">(Do not import / Ignore)</option>
                        {AVAILABLE_TARGET_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} {f.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {validateMutation.isError && (
              <div className="rounded-[var(--radius-button)] border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
                {(validateMutation.error as any)?.message || 'Validation request failed'}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('UPLOAD')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              <button
                type="button"
                onClick={handleProceedToValidate}
                disabled={validateMutation.isPending || !Object.values(mapping).includes('title')}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {validateMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Validate & Preview</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: PREVIEW & VALIDATION ERRORS ── */}
        {step === 'PREVIEW' && validationResult && (
          <div className="space-y-5">
            {/* Status Summary Banner */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    {validationResult.validCount} Valid Items
                  </span>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    Ready to be imported into this project
                  </p>
                </div>
              </div>

              <div
                className={`rounded-[var(--radius-card)] border p-3 flex items-center gap-2.5 ${
                  validationResult.invalidCount > 0
                    ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/30 text-[var(--text-muted)]'
                }`}
              >
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <span className="font-bold">
                    {validationResult.invalidCount} Invalid Rows
                  </span>
                  <p className="text-[11px] opacity-80">
                    {validationResult.invalidCount === 0
                      ? 'No errors detected. Clean import!'
                      : 'Contain validation violations'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs & Download Button */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewTab('VALID')}
                  className={`pb-1 font-semibold cursor-pointer border-b-2 transition-colors ${
                    previewTab === 'VALID'
                      ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Valid Rows ({validationResult.validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('ERRORS')}
                  className={`pb-1 font-semibold cursor-pointer border-b-2 transition-colors ${
                    previewTab === 'ERRORS'
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Errors ({validationResult.errors.length})
                </button>
              </div>

              {validationResult.errors.length > 0 && parseResult && (
                <button
                  type="button"
                  onClick={() =>
                    downloadErrorReport(validationResult.errors, parseResult.rows)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[var(--radius-button)] transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Error Report</span>
                </button>
              )}
            </div>

            {/* Tab: Valid Rows Preview */}
            {previewTab === 'VALID' && (
              <div className="max-h-[45vh] overflow-y-auto border border-[var(--border-subtle)] rounded-[var(--radius-card)]">
                {validationResult.validRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                    No valid rows found to preview.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-subtle)] sticky top-0">
                      <tr>
                        <th className="p-2 font-semibold">#</th>
                        <th className="p-2 font-semibold">Title</th>
                        <th className="p-2 font-semibold">Type</th>
                        <th className="p-2 font-semibold">State</th>
                        <th className="p-2 font-semibold">Priority</th>
                        <th className="p-2 font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {validationResult.validRows.slice(0, 20).map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-[var(--bg-surface-hover)]/30">
                          <td className="p-2 text-[var(--text-muted)]">{row.rowNumber}</td>
                          <td className="p-2 font-medium text-[var(--text-primary)] max-w-[200px] truncate">
                            {row.title}
                          </td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-surface-hover)]">
                              {row.type}
                            </span>
                          </td>
                          <td className="p-2 text-[var(--text-secondary)]">{row.state}</td>
                          <td className="p-2 text-[var(--text-secondary)]">{row.priority}</td>
                          <td className="p-2 text-[var(--text-secondary)]">{row.points ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab: Validation Errors */}
            {previewTab === 'ERRORS' && (
              <div className="max-h-[45vh] overflow-y-auto border border-[var(--border-subtle)] rounded-[var(--radius-card)] divide-y divide-[var(--border-subtle)]">
                {validationResult.errors.length === 0 ? (
                  <div className="p-8 text-center text-xs text-emerald-600">
                    No errors! All rows are completely valid.
                  </div>
                ) : (
                  validationResult.errors.map((err, i) => (
                    <div key={i} className="p-3 text-xs bg-[var(--bg-surface)] hover:bg-rose-50/20 flex items-start gap-3">
                      <div className="h-5 w-5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        !
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-rose-700 dark:text-rose-300">
                            Row {err.row}: {err.field}
                          </span>
                          {err.rawValue && (
                            <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-hover)] px-1 rounded">
                              &ldquo;{err.rawValue}&rdquo;
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--text-secondary)] mt-0.5">{err.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Transactional Mode Selector */}
            <div className="p-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/20 space-y-2 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Import Semantics & Mode:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`p-2.5 rounded-[var(--radius-button)] border flex items-start gap-2 cursor-pointer transition-colors ${
                    importMode === 'ALL_OR_NOTHING'
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="ALL_OR_NOTHING"
                    checked={importMode === 'ALL_OR_NOTHING'}
                    onChange={() => setImportMode('ALL_OR_NOTHING')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      All-or-Nothing (Strict)
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Atomic transaction: fails completely if any row has validation errors.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-2.5 rounded-[var(--radius-button)] border flex items-start gap-2 cursor-pointer transition-colors ${
                    importMode === 'SKIP_INVALID'
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="SKIP_INVALID"
                    checked={importMode === 'SKIP_INVALID'}
                    onChange={() => setImportMode('SKIP_INVALID')}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">
                      Skip Invalid Rows
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Atomically import only the valid rows and export an error report for the rest.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {executeMutation.isError && (
              <div className="rounded-[var(--radius-button)] border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
                {(executeMutation.error as any)?.message || 'Import execution failed'}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('MAPPING')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-button)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Mapping
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={
                  validationResult.validCount === 0 ||
                  (importMode === 'ALL_OR_NOTHING' && validationResult.invalidCount > 0) ||
                  executeMutation.isPending
                }
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[var(--brand-primary)] text-white rounded-[var(--radius-button)] text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <span>
                  Confirm & Import ({importMode === 'ALL_OR_NOTHING' ? validationResult.totalRows : validationResult.validCount} Items)
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: PROGRESS & COMPLETION ── */}
        {step === 'PROGRESS' && (
          <div className="space-y-6 py-4">
            {/* If still processing */}
            {!syncResult && !isJobComplete && !isJobFailed && (
              <div className="space-y-4 text-center">
                <div className="h-12 w-12 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center mx-auto">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  Executing Transactional Import...
                </h4>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                  {activeJobId
                    ? 'Processing large batch via background job worker. Updates will stream automatically.'
                    : 'Applying database transaction and creating work items...'}
                </p>

                {/* Progress bar */}
                <div className="w-full bg-[var(--bg-surface-hover)] rounded-full h-3 overflow-hidden max-w-md mx-auto">
                  <div
                    className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(10, jobProgress)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {jobProgress}% complete
                </span>
              </div>
            )}

            {/* If Completed */}
            {(syncResult || isJobComplete) && (
              <div className="space-y-5 text-center">
                <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[var(--text-primary)]">
                    Import Completed Successfully!
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Work items have been transactionally created in this project.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-center">
                  <div className="p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]/30 border border-[var(--border-subtle)]">
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {syncResult?.importedCount ?? jobResult?.importedCount ?? 0}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)]">Imported</p>
                  </div>

                  <div className="p-3 rounded-[var(--radius-card)] bg-[var(--bg-surface-hover)]/30 border border-[var(--border-subtle)]">
                    <span className="text-xl font-bold text-[var(--text-muted)]">
                      {syncResult?.skippedCount ?? jobResult?.skippedCount ?? 0}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)]">Skipped</p>
                  </div>
                </div>

                {/* Download error report if rows were skipped */}
                {(syncResult?.skippedCount || jobResult?.skippedCount) && parseResult ? (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadErrorReport(
                          syncResult?.errors ?? jobResult?.errors ?? [],
                          parseResult.rows,
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[var(--radius-button)] transition-colors cursor-pointer border border-rose-200 dark:border-rose-900"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Skipped Rows Report</span>
                    </button>
                  </div>
                ) : null}

                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-[var(--radius-button)] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                  >
                    View Work Items
                  </button>
                </div>
              </div>
            )}

            {/* If Failed */}
            {isJobFailed && (
              <div className="space-y-4 text-center">
                <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-rose-700 dark:text-rose-300">
                    Import Failed
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
                    {job?.errorMessage || 'The background transaction failed and all rows were rolled back.'}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[var(--border-subtle)] text-xs font-medium rounded-[var(--radius-button)] hover:bg-[var(--bg-surface-hover)] cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Try Again</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
