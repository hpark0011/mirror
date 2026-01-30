import { Button } from "@feel-good/ui/primitives/button";
import { SectionHeader } from "./section-header";

export function Buttons() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SectionHeader>Size: xs</SectionHeader>
        <div className="flex gap-2">
          <Button variant="default" size="xs">Default</Button>
          <Button variant="destructive" size="xs">Destructive</Button>
          <Button variant="outline" size="xs">Outline</Button>
          <Button variant="secondary" size="xs">Secondary</Button>
          <Button variant="ghost" size="xs">Ghost</Button>
          <Button variant="link" size="xs">Link</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeader>Size: sm</SectionHeader>
        <div className="flex gap-2">
          <Button variant="default" size="sm">Default</Button>
          <Button variant="destructive" size="sm">Destructive</Button>
          <Button variant="outline" size="sm">Outline</Button>
          <Button variant="secondary" size="sm">Secondary</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
          <Button variant="link" size="sm">Link</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeader>Size: default</SectionHeader>
        <div className="flex gap-2">
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionHeader>Size: lg</SectionHeader>
        <div className="flex gap-2">
          <Button variant="default" size="lg">Default</Button>
          <Button variant="destructive" size="lg">Destructive</Button>
          <Button variant="outline" size="lg">Outline</Button>
          <Button variant="secondary" size="lg">Secondary</Button>
          <Button variant="ghost" size="lg">Ghost</Button>
          <Button variant="link" size="lg">Link</Button>
        </div>
      </div>
    </div>
  );
}
