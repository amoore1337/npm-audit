import * as RadixSelect from '@radix-ui/react-select';
import clsx from 'clsx';
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { forwardRef } from 'react';

interface Props {
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Select({ placeholder, value, onValueChange, children, className }: Props) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger 
        className={clsx(
          'SelectTrigger hover:bg-green-100 text-green-600 data-[placeholder]:text-green-600 outline-none flex items-center rounded border bg-green-50 border-solid border-green-500 px-2 py-1',
          className,
        )}
        aria-label={placeholder}
      >
        <RadixSelect.Value className="" placeholder="Select a fruit…" />
        <RadixSelect.Icon className="text-green-500 ml-2">
          <ChevronDownIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="SelectContent bg-white rounded border border-solid border-green-500">
          <RadixSelect.Viewport className="SelectViewport p-1">
            {children}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export const SelectItem = forwardRef<HTMLDivElement, RadixSelect.SelectItemProps>(({ children, className, ...props }, forwardedRef) => {
  return (
    <RadixSelect.Item 
      className={clsx(
        'SelectItem relative text-green-600 data-[highlighted]:bg-green-500 data-[highlighted]:text-white pl-6 pr-4 py-1 border-none rounded select-none outline-none', 
        className
      )} 
      {...props} 
      ref={forwardedRef}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="SelectItemIndicator absolute top-0 left-0 w-[25px] flex items-center justify-center">
        <CheckIcon className='mt-[10px]' />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

SelectItem.displayName = 'SelectItem';