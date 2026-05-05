import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import type { PortfolioRow } from '@/lib/types';
import { formatSetNumber } from '@/lib/types';
import { formatCurrency } from '@/lib/price-utils';
import { useI18n } from '@/lib/i18n';
import { CurrencyBadge } from './CurrencyBadge';
import { translateGermanName } from '@/lib/german-pokemon-names';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface CardTableProps {
  rows: PortfolioRow[];
  onRowClick?: (row: PortfolioRow) => void;
}

const columnHelper = createColumnHelper<PortfolioRow>();

export function CardTable({ rows, onRowClick }: CardTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'currentPrice', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const { t, tr } = useI18n();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'image',
        header: '',
        size: 56,
        cell: ({ row }) => (
          <img
            src={row.original.card.images.small}
            alt={row.original.card.name}
            className="card-thumb w-10 h-14 object-contain rounded"
            loading="lazy"
          />
        ),
      }),
      columnHelper.accessor((r) => r.card.name, {
        id: 'name',
        header: t('table.card'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-sm">{row.original.card.name}</div>
            <div className="text-xs text-gray-500">
              <span className="font-semibold text-gray-600 dark:text-gray-400">{formatSetNumber(row.original.card.set, row.original.card.number)}</span> · {row.original.card.set.name}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor((r) => r.userCard.owner, {
        id: 'owner',
        header: t('table.owner'),
        cell: ({ getValue }) => (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{getValue()}</span>
        ),
      }),
      columnHelper.accessor((r) => r.card.rarity ?? '', {
        id: 'rarity',
        header: t('table.rarity'),
        cell: ({ row }) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">{tr('rarity', row.original.card.rarity ?? '')}</span>
        ),
      }),
      columnHelper.accessor((r) => r.userCard.condition, {
        id: 'condition',
        header: t('table.condition'),
        cell: ({ getValue }) => {
          const c = getValue();
          const colors: Record<string, string> = {
            NM: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            LP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
            MP: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
            HP: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            DMG: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
          };
          return (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colors[c] ?? ''}`}>
              {tr('condition', c)}
            </span>
          );
        },
      }),
      columnHelper.accessor((r) => r.userCard.quantity, {
        id: 'qty',
        header: t('table.qty'),
        size: 50,
      }),
      columnHelper.accessor('currentPrice', {
        header: () => <span title="Price Trend">{t('table.trend')}</span>,
        sortingFn: 'basic',
        cell: ({ row }) => (
          <CurrencyBadge
            value={row.original.currentPrice}
            currency={row.original.currency}
            href={row.original.sourceUrl}
          />
        ),
      }),
      columnHelper.accessor('lowPrice', {
        header: t('table.from'),
        sortingFn: 'basic',
        size: 80,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatCurrency(row.original.lowPrice, row.original.currency)}
          </span>
        ),
      }),
      columnHelper.accessor('avg1', {
        header: t('table.avg1'),
        sortingFn: 'basic',
        size: 80,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatCurrency(row.original.avg1, row.original.currency)}
          </span>
        ),
      }),
      columnHelper.accessor('avg7', {
        header: t('table.avg7'),
        sortingFn: 'basic',
        size: 80,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatCurrency(row.original.avg7, row.original.currency)}
          </span>
        ),
      }),
      columnHelper.accessor('avg30', {
        header: t('table.avg30'),
        sortingFn: 'basic',
        size: 80,
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatCurrency(row.original.avg30, row.original.currency)}
          </span>
        ),
      }),
    ],
    [t, tr],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const trimmedFilter = filterValue.trim();
      const search = trimmedFilter.toLowerCase();
      const translatedSearch = (translateGermanName(trimmedFilter) ?? trimmedFilter).toLowerCase();
      const r = row.original;
      const cardName = r.card.name.toLowerCase();
      return (
        cardName.includes(search) ||
        cardName.includes(translatedSearch) ||
        r.card.set.name.toLowerCase().includes(search) ||
        r.userCard.owner.toLowerCase().includes(search) ||
        tr('condition', r.userCard.condition).toLowerCase().includes(search) ||
        tr('rarity', r.card.rarity ?? '').toLowerCase().includes(search)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('table.search')}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <span className="text-sm text-slate-500">
          {table.getFilteredRowModel().rows.length} {t('table.cardsCount')}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    data-sortable={header.column.getCanSort() || undefined}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        header.column.getIsSorted() === 'asc'
                          ? <ChevronUp className="w-3 h-3 text-blue-500" />
                          : header.column.getIsSorted() === 'desc'
                          ? <ChevronDown className="w-3 h-3 text-blue-500" />
                          : <ChevronsUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <div>
            {t('table.page')} {table.getState().pagination.pageIndex + 1} {t('table.of')} {table.getPageCount()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t('table.previous')}
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('table.next')}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
