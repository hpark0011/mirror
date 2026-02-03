import { MagicLinkLoginForm } from "@/app/blocks/login/_components/magic-link-login-form";
import { PasswordLoginForm } from "@/app/blocks/login/_components/password-login-form";
import { Divider } from "@/components/divider";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";

export function LoginView() {
  return (
    <div className="flex flex-col w-full">
      <Divider />
      <PageSection>
        <PageSectionHeader>Password</PageSectionHeader>
        <PasswordLoginForm />
      </PageSection>

      <Divider />
      <PageSection>
        <PageSectionHeader>Magic Link</PageSectionHeader>
        <MagicLinkLoginForm />
      </PageSection>
    </div>
  );
}
