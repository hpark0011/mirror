"use client";

import { useState } from "react";
import { FilesHeader } from "@/components/files/files-header";
import { FilesList } from "@/components/files/files-list";
import { BodyContainer } from "@/components/layout/layout-ui";

export default function FilesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Trigger refresh when needed (e.g., after upload)
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <>
      <FilesHeader onUploadComplete={handleRefresh} />
      <BodyContainer className="justify-center">
        <div className="px-6 py-0 w-full">
          <div className="mb-6">
            <h2 className="text-lg font-medium">All Files</h2>
          </div>

          {/* Files data table */}
          <FilesList refreshTrigger={refreshTrigger} />
        </div>
      </BodyContainer>
    </>
  );
}
