import clsx from "clsx";
import type { ComponentPropsWithRef} from "react";
import { forwardRef } from "react"

type VariantType = 'primary' | 'secondary' | 'outlined';

interface Props extends ComponentPropsWithRef<'button'> {
  variant?: VariantType;
}

const SHARED_CLASSES = 'rounded px-3 py-1 border border-solid'

const CLASS_MAP: Record<VariantType, string> = {
  primary: 'border-green-500 hover:border-green-600 bg-green-500 text-white hover:bg-green-600',
  secondary: 'border-sky-500 text-sky-500 bg-sky-100 hover:bg-sky-200',
  outlined: 'border-gray-600 bg-white text-gray-600 hover:bg-gray-100',
};

export const Button = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { className, variant = 'outlined',  ...rest } = props;
  return (
    <button className={clsx(SHARED_CLASSES, CLASS_MAP[variant], className)} data-button={variant} {...rest} ref={ref} />
  );
})

Button.displayName = 'Button';
