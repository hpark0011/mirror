import { ButtonGroupWrapper } from "@/app/components/buttons/_components/button-group-wrapper";
import { ButtonsSection } from "@/app/components/buttons/_components/buttons-section";
import { ButtonsSectionHeader } from "@/app/components/buttons/_components/buttons-section-header";
import { Divider } from "@/components/divider";
import { Button } from "@feel-good/ui/primitives/button";
import { PlusIcon } from "lucide-react";
import { BUTTON_VARIANTS } from "../_utils/button-variants.config";

const variantLabels: Record<(typeof BUTTON_VARIANTS)[number], string> = {
  default: "Default",
  primary: "Primary",
  secondary: "Secondary",
  outline: "Outline",
  ghost: "Ghost",
  link: "Link",
  destructive: "Destructive",
};

export function Buttons() {
  return (
    <div className="flex flex-col">
      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: xs</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="xs">
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: sm</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="sm">
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: default</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variantLabels[variant]}
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: lg</ButtonsSectionHeader>
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
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: icon-xs</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon-xs">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: icon-sm</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon-sm">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: icon</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />

      <ButtonsSection>
        <ButtonsSectionHeader>Size: icon-lg</ButtonsSectionHeader>
        <ButtonGroupWrapper>
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant} size="icon-lg">
              <PlusIcon />
            </Button>
          ))}
        </ButtonGroupWrapper>
      </ButtonsSection>

      <Divider />
    </div>
  );
}
