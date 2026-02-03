import { MagicLinkSignUpForm } from "@/app/blocks/sign-up/_components/magic-link-sign-up-form";
import { PasswordSignUpForm } from "@/app/blocks/sign-up/_components/password-sign-up-form";
import { Divider } from "@/components/divider";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";

export function SignUpView() {
  return (
    <div className="flex flex-col w-full">
      <Divider />
      <PageSection>
        <PageSectionHeader>Password</PageSectionHeader>
        <PasswordSignUpForm />
      </PageSection>

      <Divider />
      <PageSection>
        <PageSectionHeader>Magic Link</PageSectionHeader>
        <MagicLinkSignUpForm />
      </PageSection>
    </div>
  );
}
