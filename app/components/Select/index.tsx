import * as RadixSelect from "@radix-ui/react-select";
import clsx from "clsx";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { forwardRef } from "react";

interface Props {
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Select({
  placeholder,
  value,
  onValueChange,
  children,
  className,
}: Props) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        className={clsx(
          "SelectTrigger flex items-center rounded border border-solid border-green-500 bg-green-50 px-2 py-1 text-green-600 outline-none hover:bg-green-100 data-[placeholder]:text-green-600",
          className
        )}
        aria-label={placeholder}
      >
        <RadixSelect.Value className="" placeholder="Select a fruit…" />
        <RadixSelect.Icon className="ml-2 text-green-500">
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="SelectContent rounded border border-solid border-green-500 bg-white">
          <RadixSelect.Viewport className="SelectViewport p-1">
            {children}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export const SelectItem = forwardRef<
  HTMLDivElement,
  RadixSelect.SelectItemProps
>(({ children, className, ...props }, forwardedRef) => {
  return (
    <RadixSelect.Item
      className={clsx(
        "SelectItem relative select-none rounded border-none py-1 pl-6 pr-4 text-green-600 outline-none data-[highlighted]:bg-green-500 data-[highlighted]:text-white",
        className
      )}
      {...props}
      ref={forwardedRef}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="SelectItemIndicator absolute top-0 left-0 flex h-full w-[25px] items-center justify-center">
        <CheckIcon />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

SelectItem.displayName = "SelectItem";
