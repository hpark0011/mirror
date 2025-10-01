"use client";

import { useState } from "react";
import { FilesHeader } from "@/components/files/files-header";
import { FilesList } from "@/components/files/files-list";
import { BodyContainer } from "@/components/layout/layout-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export default function FilesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Trigger refresh when needed (e.g., after upload)
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <FilesHeader onUploadComplete={handleRefresh} />
      <BodyContainer>
        <div className='px-5 py-4 w-full'>
          {/* View mode toggle */}
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-lg font-medium'>All</h2>
            <div className='flex items-center rounded-md p-0.5'>
              <Button
                size='sm'
                variant='icon'
                onClick={() => setViewMode("grid")}
                className={cn(
                  viewMode === "grid" ? "bg-[var(--color-extra-light)]" : "",
                  "h-6 rounded-sm"
                )}
              >
                <Icon
                  name='SquareGrid2x2FillInIcon'
                  className='w-4 h-4 text-icon-light'
                />
              </Button>
              <Button
                size='sm'
                variant='icon'
                onClick={() => setViewMode("list")}
                className={cn(
                  viewMode === "list" ? "bg-[var(--color-extra-light)]" : "",
                  "h-6 rounded-sm"
                )}
              >
                <Icon
                  name='ListBulletIcon'
                  className='w-4 h-4 text-icon-light'
                />
              </Button>
            </div>
          </div>

          {/* Files list component */}
          <FilesList refreshTrigger={refreshTrigger} view={viewMode} />
        </div>
      </BodyContainer>
    </>
  );
}
