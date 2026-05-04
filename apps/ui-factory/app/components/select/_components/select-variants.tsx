"use client";

import { Divider } from "@/components/divider";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";

export function SelectVariants() {
  return (
    <div className="flex flex-col w-full pb-24">
      <Divider />

      <PageSection>
        <PageSectionHeader>Default</PageSectionHeader>
        <Select>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="blueberry">Blueberry</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
            <SelectItem value="pineapple">Pineapple</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Variant: Underline</PageSectionHeader>
        <Select>
          <SelectTrigger variant="underline" className="w-[200px]">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: Default</PageSectionHeader>
        <Select>
          <SelectTrigger size="default" className="w-[200px]">
            <SelectValue placeholder="Default size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: Small</PageSectionHeader>
        <Select>
          <SelectTrigger size="sm" className="w-[200px]">
            <SelectValue placeholder="Small size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Groups & Labels</PageSectionHeader>
        <Select>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select a timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>North America</SelectLabel>
              <SelectItem value="est">Eastern Standard Time</SelectItem>
              <SelectItem value="cst">Central Standard Time</SelectItem>
              <SelectItem value="mst">Mountain Standard Time</SelectItem>
              <SelectItem value="pst">Pacific Standard Time</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Europe</SelectLabel>
              <SelectItem value="gmt">Greenwich Mean Time</SelectItem>
              <SelectItem value="cet">Central European Time</SelectItem>
              <SelectItem value="eet">Eastern European Time</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Pre-selected</PageSectionHeader>
        <Select defaultValue="banana">
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Disabled</PageSectionHeader>
        <Select disabled>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Disabled" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Disabled Item</PageSectionHeader>
        <Select>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a fruit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana" disabled>
              Banana (out of stock)
            </SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Invalid</PageSectionHeader>
        <Select>
          <SelectTrigger aria-invalid className="w-[200px]">
            <SelectValue placeholder="Required field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
          </SelectContent>
        </Select>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Long List (Scroll)</PageSectionHeader>
        <Select>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a number" />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {Array.from({ length: 30 }, (_, i) => (
              <SelectItem key={i} value={`item-${i + 1}`}>
                Item {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageSection>
    </div>
  );
}
