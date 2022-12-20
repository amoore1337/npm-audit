import clsx from "clsx";
import type { ComponentPropsWithRef } from "react";
import { forwardRef } from "react";

interface Props extends ComponentPropsWithRef<"textarea"> {}

const CLASSES =
  "text-sm leading-[1.4] rounded border border-solid border-gray-600 resize-none p-2 focus:outline focus:outline-green-300";

export const TextArea = forwardRef<HTMLTextAreaElement, Props>((props, ref) => {
  const { className, ...rest } = props;

  return (
    <textarea
      className={clsx(CLASSES, className)}
      data-textarea
      ref={ref}
      {...rest}
    />
  );
});

TextArea.displayName = "TextArea";
