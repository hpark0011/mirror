"use client";

import { PageSection } from "@/components/page-section";
import { PageSectionHeader } from "@/components/page-section-header";
import { Divider } from "@/components/divider";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "@feel-good/ui/primitives/input-group";
import { Kbd } from "@feel-good/ui/primitives/kbd";
import {
  AtSignIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  MailIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react";
import { useState } from "react";

export function InputGroupVariants() {
  return (
    <div className="flex w-full flex-col">
      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Inline Start (Icon)</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <SearchIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Search..." />
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Inline End (Icon)</PageSectionHeader>
        <InputGroup>
          <InputGroupInput placeholder="Enter email" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>
              <MailIcon />
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Both Sides</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <LinkIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Enter URL" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>
              <CopyIcon />
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Text Prefix</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>https://</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="example.com" />
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Text Suffix</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <AtSignIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="username" />
          <InputGroupAddon align="inline-end">
            <InputGroupText>.example.com</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Block Start</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="block-start">
            <InputGroupText>Label above the input</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Type here..." />
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Addon: Block End</PageSectionHeader>
        <InputGroup>
          <InputGroupInput placeholder="Type here..." />
          <InputGroupAddon align="block-end">
            <InputGroupText>Helper text below</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Button Size: xs (Default)</PageSectionHeader>
        <InputGroup>
          <InputGroupInput placeholder="Search..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton>Go</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Button Size: sm</PageSectionHeader>
        <InputGroup>
          <InputGroupInput placeholder="Search..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="sm">Search</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Button Size: icon-xs</PageSectionHeader>
        <InputGroup>
          <InputGroupInput placeholder="Enter message..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs">
              <SendIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>Button Size: icon-sm</PageSectionHeader>
        <InputGroup>
          <InputGroupInput placeholder="Enter message..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm">
              <SendIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PasswordToggleDemo />

      <Divider />

      <PageSection>
        <PageSectionHeader>With Kbd</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <SearchIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Quick search..." />
          <InputGroupAddon align="inline-end">
            <Kbd>⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>With Textarea</PageSectionHeader>
        <InputGroup>
          <InputGroupTextarea placeholder="Write a message..." rows={3} />
          <InputGroupAddon align="block-end">
            <InputGroupButton size="sm">
              <SendIcon />
              Send
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Invalid</PageSectionHeader>
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <MailIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Enter email" aria-invalid="true" />
        </InputGroup>
      </PageSection>

      <Divider />

      <PageSection>
        <PageSectionHeader>State: Disabled</PageSectionHeader>
        <InputGroup data-disabled="true">
          <InputGroupAddon align="inline-start">
            <InputGroupText>
              <SearchIcon />
            </InputGroupText>
          </InputGroupAddon>
          <InputGroupInput placeholder="Disabled input" disabled />
        </InputGroup>
      </PageSection>
    </div>
  );
}

function PasswordToggleDemo() {
  const [show, setShow] = useState(false);

  return (
    <PageSection>
      <PageSectionHeader>Interactive: Password Toggle</PageSectionHeader>
      <InputGroup>
        <InputGroupInput
          type={show ? "text" : "password"}
          placeholder="Enter password"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </PageSection>
  );
}
