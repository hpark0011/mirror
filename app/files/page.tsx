import { FilesHeader } from "@/components/files/files-header";
import { BodyContainer } from "@/components/layout/layout-ui";

export default function FilesPage() {
  return (
    <>
      <FilesHeader />
      <BodyContainer>
        <div className='px-5'>Files</div>
      </BodyContainer>
    </>
  );
}
