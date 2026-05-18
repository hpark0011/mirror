import { ButtonGroupWrapper } from "@/app/components/buttons/_components/button-group-wrapper";
import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";
import { Button } from "@feel-good/ui/primitives/button";
import { PlusIcon } from "lucide-react";
import { BUTTON_VARIANTS } from "../_utils/button-variants.config";
import { ShinyButton } from "@feel-good/ui/components/shiny-button";

const variantLabels: Record<(typeof BUTTON_VARIANTS)[number], string> = {
  default: "Default",
  primary: "Primary",
  secondary: "Secondary",
  outline: "Outline",
  ghost: "Ghost",
  link: "Link",
  destructive: "Destructive",
  wrapper: "Wrapper",
};

export function ButtonVariants() {
  return (
    <div className="flex flex-col w-full">
      <Divider />

      <PageSection>
        <PageSectionHeader>Size: xs</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="xs">
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: sm</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="sm">
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: default</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: lg</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button
              key={variant}
              variant={variant}
              size="lg"
            >
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: icon-xs</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon-xs">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: icon-sm</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon-sm">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: icon</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Size: icon-lg</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon-lg">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Icon</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              <PlusIcon />
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Icon (sm)</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="sm">
              <PlusIcon />
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Icon (lg)</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="lg">
              <PlusIcon />
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Disabled</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Variant: Shiny</PageSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <ShinyButton key={variant}>
              {variantLabels[variant]}
            </ShinyButton>
          ))}
        </ButtonGroupWrapper>
      </PageSection>
    </div>
  );
}
