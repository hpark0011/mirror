"use client";

import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";

import { DataTable } from "./data-table";
import {
  basicColumns,
  sortableColumns,
  fullColumns,
  sampleData,
} from "./columns";

export function DataTableVariants() {
  return (
    <div className="flex flex-col w-full">
      <Divider />

      <PageSection>
        <PageSectionHeader>Basic</PageSectionHeader>
        <DataTable columns={basicColumns} data={sampleData} />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Sorting</PageSectionHeader>
        <DataTable columns={sortableColumns} data={sampleData} />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Filtering</PageSectionHeader>
        <DataTable
          columns={sortableColumns}
          data={sampleData}
          filterColumn="email"
          filterPlaceholder="Filter emails..."
        />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>
          Full: Selection + Sorting + Filtering + Column Visibility + Actions
        </PageSectionHeader>
        <DataTable
          columns={fullColumns}
          data={sampleData}
          filterColumn="email"
          filterPlaceholder="Filter emails..."
          enableColumnVisibility
        />
      </PageSection>
    </div>
  );
}
