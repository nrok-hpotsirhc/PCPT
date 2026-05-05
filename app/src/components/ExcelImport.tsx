import { useState, useCallback } from 'react';
import { parseExcelFile, downloadTemplate, exportToExcel } from '@/lib/excel-parser';
import { useI18n } from '@/lib/i18n';
import type { UserCard, Card } from '@/lib/types';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

interface ExcelImportProps {
  onImport: (cards: UserCard[]) => void;
  userCards: UserCard[];
  cards: Card[];
}

export function ExcelImport({ onImport, userCards, cards }: ExcelImportProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [imported, setImported] = useState(0);
  const { t } = useI18n();

  const handleFile = useCallback(
    async (file: File) => {
      setErrors([]);
      setImported(0);

      const buffer = await file.arrayBuffer();
      const result = parseExcelFile(buffer);

      if (result.errors.length > 0) {
        setErrors(result.errors);
      }

      if (result.success.length > 0) {
        onImport(result.success);
        setImported(result.success.length);
      }
    },
    [onImport],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleExport() {
    exportToExcel(userCards, cards);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        <div className="flex items-center justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Upload className="w-6 h-6 text-slate-400" />
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('import.drop')}{' '}
          <label className="text-blue-600 hover:underline cursor-pointer font-medium">
            {t('import.browse')}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
              className="hidden"
            />
          </label>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {t('import.formats')}
        </p>
      </div>

      {/* Template download */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => downloadTemplate()}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline text-left font-medium"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {t('import.template')}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={userCards.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          <Download className="w-4 h-4" />
          {t('import.export')}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {userCards.length > 0 ? t('import.exportHint') : t('import.exportEmpty')}
      </p>

      {/* Import result */}
      {imported > 0 && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {imported} {t('import.success')}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {errors.length} {t('import.errors')}
            </p>
          </div>
          <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
            {errors.map((err, i) => (
              <li key={i}>Row {err.row}: {err.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
