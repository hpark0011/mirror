"use client";

import { useState } from "react";
import { FilesHeader } from "@/components/files/files-header";
import { FilesList } from "@/components/files/files-list";
import { BodyContainer } from "@/components/layout/layout-ui";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

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
            <h2 className='text-lg font-semibold'>Your Files</h2>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant={viewMode === "grid" ? "default" : "ghost"}
                onClick={() => setViewMode("grid")}
                className='h-8 w-8 p-0'
              >
                <Icon name='SquareGrid2x2FillInIcon' className='w-4 h-4' />
              </Button>
              <Button
                size='sm'
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                className='h-8 w-8 p-0'
              >
                <Icon name='ListBulletIcon' className='w-4 h-4' />
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
