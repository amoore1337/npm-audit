import type { ToggleProps } from "@radix-ui/react-toggle";
import * as RadixToggle from "@radix-ui/react-toggle";
import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";

interface Props extends ComponentPropsWithRef<"button">, ToggleProps {}

export function Toggle({ children, className, ...props }: Props) {
  return (
    <RadixToggle.Root
      className={clsx(
        "rounded border border-solid border-green-500 px-3 py-1 text-green-600 data-[state=on]:bg-green-500 data-[state=on]:text-white",
        "hover:bg-green-100 data-[state=on]:hover:bg-green-600",
        className
      )}
      {...props}
    >
      {children}
    </RadixToggle.Root>
  );
}
