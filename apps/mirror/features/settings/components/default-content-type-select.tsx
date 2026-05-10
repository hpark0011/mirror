"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-good/ui/primitives/select";
import {
  DEFAULT_PROFILE_SECTION_VALUES,
  type DefaultProfileSection,
} from "@feel-good/convex/convex/content/href";
import { useTranslation } from "react-i18next";
import { PROFILE_TAB_LABELS } from "@/features/profile-tabs/types";

type DefaultContentTypeSelectProps = {
  value: DefaultProfileSection;
  onChange: (value: DefaultProfileSection) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ value: DefaultProfileSection; label: string }> =
  DEFAULT_PROFILE_SECTION_VALUES.map((value) => ({
    value,
    label: PROFILE_TAB_LABELS[value],
  }));

export function DefaultContentTypeSelect({
  value,
  onChange,
  disabled = false,
}: DefaultContentTypeSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        onChange(nextValue as DefaultProfileSection);
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className="w-full"
        data-testid="default-content-type-select"
      >
        <SelectValue
          placeholder={t("settings.defaultContentType.placeholder", {
            defaultValue: "Select default content type",
          })}
        />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {t(`profileTabs.${option.value}`, { defaultValue: option.label })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
