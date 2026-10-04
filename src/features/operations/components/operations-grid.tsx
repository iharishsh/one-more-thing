"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type RowClickedEvent,
} from "ag-grid-community";
import type { OperationsRow } from "@/features/operations/operations.service";
import { formatUsd } from "@/lib/money";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  backgroundColor: "#ffffff",
  foregroundColor: "#000000",
  headerBackgroundColor: "#ebeff5",
  oddRowBackgroundColor: "#fafbfc",
  borderColor: "#d5dbe3",
  fontFamily: "var(--font-plain), DM Sans, sans-serif",
  headerFontFamily: "var(--font-pro), Outfit, sans-serif",
  headerFontWeight: 700,
  spacing: 12,
  borderRadius: 12,
  accentColor: "#029be1",
});

export function OperationsGrid({ rows }: { rows: OperationsRow[] }) {
  const router = useRouter();
  const gridRef = useRef<AgGridReact<OperationsRow>>(null);

  const columnDefs = useMemo<ColDef<OperationsRow>[]>(
    () => [
      {
        field: "projectTitle",
        headerName: "Project",
        filter: true,
        minWidth: 140,
      },
      {
        field: "clientRequest",
        headerName: "Client request",
        flex: 1.4,
        minWidth: 220,
        wrapText: true,
        autoHeight: true,
        filter: true,
      },
      {
        field: "scopeFinding",
        headerName: "Scope finding",
        filter: true,
        minWidth: 120,
      },
      {
        field: "agreement",
        headerName: "Agreement",
        filter: true,
        minWidth: 130,
      },
      {
        field: "amountCents",
        headerName: "Amount",
        minWidth: 100,
        valueFormatter: (p) =>
          p.value == null || p.value === 0 ? "—" : formatUsd(p.value),
        filter: "agNumberColumnFilter",
      },
      {
        field: "payment",
        headerName: "Payment",
        filter: true,
        minWidth: 120,
      },
      {
        field: "nextAction",
        headerName: "Next action",
        filter: true,
        minWidth: 160,
      },
    ],
    [],
  );

  function onRowClicked(event: RowClickedEvent<OperationsRow>) {
    if (event.data?.href) router.push(event.data.href);
  }

  return (
    <div className="h-[min(70vh,640px)] w-full overflow-x-auto overflow-y-hidden rounded-[var(--radius-xl)] border border-border bg-card">
      <div className="min-w-[720px] h-full">
      <AgGridReact<OperationsRow>
        ref={gridRef}
        theme={gridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={{
          sortable: true,
          resizable: true,
          filter: true,
        }}
        animateRows
        rowSelection="single"
        onRowClicked={onRowClicked}
        getRowId={(p) => p.data.id}
        suppressCellFocus
      />
      </div>
    </div>
  );
}
