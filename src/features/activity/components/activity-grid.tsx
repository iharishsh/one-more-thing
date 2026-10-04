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
  type ValueFormatterParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

export type ActivityGridRow = {
  id: string;
  projectTitle: string;
  kind: string;
  kindLabel: string;
  message: string;
  createdAt: string;
  href: string | null;
};

const gridTheme = themeQuartz.withParams({
  backgroundColor: "#ffffff",
  foregroundColor: "#000000",
  headerBackgroundColor: "#ebeff5",
  oddRowBackgroundColor: "#fafbfc",
  borderColor: "#d5dbe3",
  fontFamily: "var(--font-plain), DM Sans, sans-serif",
  headerFontFamily: "var(--font-plain), DM Sans, sans-serif",
  headerFontWeight: 700,
  spacing: 12,
  borderRadius: 12,
  accentColor: "#029be1",
});

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ActivityGrid({ rows }: { rows: ActivityGridRow[] }) {
  const router = useRouter();
  const gridRef = useRef<AgGridReact<ActivityGridRow>>(null);

  const columnDefs = useMemo<ColDef<ActivityGridRow>[]>(
    () => [
      {
        field: "createdAt",
        headerName: "When",
        minWidth: 150,
        maxWidth: 190,
        sort: "desc",
        valueFormatter: (p: ValueFormatterParams<ActivityGridRow, string>) =>
          p.value ? formatWhen(p.value) : "—",
        filter: true,
        comparator: (a?: string, b?: string) =>
          new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime(),
      },
      {
        field: "projectTitle",
        headerName: "Project",
        filter: true,
        minWidth: 160,
      },
      {
        field: "kindLabel",
        headerName: "Type",
        filter: true,
        minWidth: 140,
      },
      {
        field: "message",
        headerName: "Activity",
        flex: 1.6,
        minWidth: 260,
        wrapText: true,
        autoHeight: true,
        filter: true,
      },
    ],
    [],
  );

  function onRowClicked(event: RowClickedEvent<ActivityGridRow>) {
    if (event.data?.href) router.push(event.data.href);
  }

  return (
    <div className="h-[min(70vh,640px)] w-full overflow-x-auto overflow-y-hidden rounded-[var(--radius-xl)] border border-border bg-card">
      <div className="h-full min-w-[720px]">
        <AgGridReact<ActivityGridRow>
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
          overlayNoRowsTemplate="No activity yet."
        />
      </div>
    </div>
  );
}
