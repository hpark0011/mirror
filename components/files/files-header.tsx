"use client";

import { useState } from "react";
import {
  HeaderContainer,
  HeaderLogo,
  HeaderMenu,
} from "@/components/header/header-ui";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Icon } from "@/components/ui/icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigation } from "@/hooks/use-navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileUploadDialog } from "./file-upload-dialog";

interface FilesHeaderProps {
  onUploadComplete?: () => void;
}

export function FilesHeader({ onUploadComplete }: FilesHeaderProps) {
  const { getCurrentValue, handleNavigate, navItems } = useNavigation();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  
  const handleDialogClose = (open: boolean) => {
    setIsUploadDialogOpen(open);
    // Call onUploadComplete when dialog closes after successful upload
    if (!open && onUploadComplete) {
      onUploadComplete();
    }
  };

  return (
    <HeaderContainer className='justify-between'>
      <Breadcrumb>
        <BreadcrumbList className='items-center text-[15px] text-foreground sm:gap-0'>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href='/' aria-label='Go to home'>
                <HeaderLogo />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className='text-neutral-400/50 pt-0.5 dark:text-neutral-700 [&>svg]:!size-5 ml-1'>
            <Icon
              name='LineDiagonalIcon'
              className=' text-neutral-400/50 dark:text-neutral-700'
            />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className='text-[15px]'>
              <Select value={getCurrentValue()} onValueChange={handleNavigate}>
                <SelectTrigger className='outline-none hover:bg-extra-light rounded-sm border-none data-[size=default]:h-6 data-[size=sm]:h-6 focus-visible:bg-extra-light focus-visible:ring-0'>
                  <div className='flex items-center gap-1.5 pr-0.5 py-0.5 rounded-sm leading-[1.0] '>
                    <SelectValue />
                    <Icon
                      name='TriangleFillDownIcon'
                      className='size-2 text-icon-extra-light'
                    />
                  </div>{" "}
                </SelectTrigger>
                <SelectContent
                  side='bottom'
                  align='start'
                  sideOffset={0}
                  className='rounded-[11px]'
                >
                  {navItems.map((item) => (
                    <SelectItem key={item.href} value={item.label}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <HeaderMenu>
        <Button
          variant='primary'
          size='sm'
          onClick={() => setIsUploadDialogOpen(true)}
        >
          <Icon name='PaperClipIcon' /> Add Files
        </Button>
      </HeaderMenu>

      <FileUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={handleDialogClose}
      />
    </HeaderContainer>
  );
}
