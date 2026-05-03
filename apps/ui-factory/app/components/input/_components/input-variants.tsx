import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@feel-good/ui/primitives/field";
import { Input } from "@feel-good/ui/primitives/input";

export function InputVariants() {
  return (
    <div className="flex flex-col w-full">
      <Divider />

      <PageSection>
        <PageSectionHeader>Input Variant: Default</PageSectionHeader>
        <Input placeholder="Enter your email" />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Input Variant: Underline</PageSectionHeader>
        <Input placeholder="Enter your email" variant="underline" />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: Default</PageSectionHeader>
        <Input size="default" placeholder="Default size" />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: Small</PageSectionHeader>
        <Input size="sm" placeholder="Small size" />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>
          Invalid
        </PageSectionHeader>
        <Input placeholder="Enter your email" aria-invalid />
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>
          With Label
        </PageSectionHeader>
        <Field>
          <FieldLabel htmlFor="fieldgroup-name">Name</FieldLabel>
          <Input id="fieldgroup-name" placeholder="Jordan Lee" />
        </Field>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>
          With Description
        </PageSectionHeader>
        <Field>
          <FieldLabel htmlFor="input-field-username">Username</FieldLabel>
          <Input
            id="input-field-username"
            type="text"
            placeholder="Enter your username"
          />
          <FieldDescription>
            Choose a unique username for your account.
          </FieldDescription>
        </Field>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>
          Form
        </PageSectionHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="fieldgroup-form-name">
              Name
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="fieldgroup-form-name"
              placeholder="Jordan Lee"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="fieldgroup-form-email">
              Email
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="fieldgroup-form-email"
              type="email"
              placeholder="name@example.com"
              required
            />
            <FieldDescription>
              We&apos;ll send updates to this address.
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <Button type="reset" variant="outline">
              Reset
            </Button>
            <Button type="submit" variant="primary">Submit</Button>
          </Field>
        </FieldGroup>
      </PageSection>
    </div>
  );
}
