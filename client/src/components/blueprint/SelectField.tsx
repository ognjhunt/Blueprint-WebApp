import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@/components/ui/select";

export interface SelectFieldOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectFieldProps {
  /** Caption-size 600 label rendered above the field. */
  label?: React.ReactNode;
  /** Muted helper text shown below the field (suppressed when `error` is set). */
  hint?: React.ReactNode;
  /** Blocker-fg error text shown below the field. Toggles the error border + a11y state. */
  error?: React.ReactNode;
  /** Placeholder shown when no value is selected. */
  placeholder?: string;
  /** Options rendered in the dropdown. Optional — pass `children` for full control. */
  options?: SelectFieldOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** Class applied to the outer wrapper. */
  containerClassName?: string;
  /** Class applied to the trigger element. */
  className?: string;
  /** Custom dropdown content; when set, `options` is ignored. */
  children?: React.ReactNode;
}

/**
 * Blueprint-styled Radix Select trigger. Matches Field exactly: panel ground,
 * line-strong border (-> runway-red on error), square, height 2.625rem,
 * pad 0 .65rem, body-s 14px strong text, signal focus ring, faint chevron.
 */
const SelectFieldTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    hasError?: boolean;
  }
>(({ className, children, hasError, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    aria-invalid={hasError || undefined}
    className={cn(
      "flex h-[2.625rem] w-full items-center justify-between gap-2 rounded-none border border-runway-line-strong bg-runway-panel px-[0.65rem]",
      "text-body-s font-medium text-runway-text outline-none transition-shadow duration-200 ease-standard",
      "data-[placeholder]:font-normal data-[placeholder]:text-runway-faint",
      "focus:border-runway-signal focus:ring-1 focus:ring-runway-signal",
      "disabled:cursor-not-allowed disabled:opacity-45",
      "[&>span]:line-clamp-1 [&>span]:text-left",
      hasError && "border-runway-red focus:border-runway-red focus:ring-runway-red",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown
        className="h-[0.85rem] w-[0.85rem] shrink-0 text-runway-faint"
        strokeWidth={1.75}
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectFieldTrigger.displayName = "SelectFieldTrigger";

/**
 * SelectField — Blueprint select, styled to match Field, with label/hint/error
 * + options support. Built on shadcn Select (Radix).
 */
export function SelectField({
  label,
  hint,
  error,
  placeholder,
  options,
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  id,
  containerClassName,
  className,
  children,
}: SelectFieldProps) {
  const reactId = React.useId();
  const triggerId = id ?? reactId;
  const hintId = `${triggerId}-hint`;
  const errorId = `${triggerId}-error`;
  const hasError = Boolean(error);

  return (
    <div className={cn("flex w-full flex-col gap-1.5", containerClassName)}>
      {label ? (
        <label
          htmlFor={triggerId}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-runway-faint"
        >
          {label}
        </label>
      ) : null}

      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
      >
        <SelectFieldTrigger
          id={triggerId}
          hasError={hasError}
          aria-describedby={hasError ? errorId : hint ? hintId : undefined}
          className={className}
        >
          <SelectValue placeholder={placeholder} />
        </SelectFieldTrigger>

        <SelectContent className="rounded-none border-runway-line bg-runway-panel text-runway-body">
          {children ??
            (options ? (
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="rounded-none text-body-s text-runway-body focus:bg-runway-raised focus:text-runway-text data-[state=checked]:font-semibold data-[state=checked]:text-runway-signal"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null)}
        </SelectContent>
      </Select>

      {hasError ? (
        <p id={errorId} className="text-caption text-runway-red">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-runway-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
SelectField.displayName = "SelectField";

export { SelectFieldTrigger };

/* Re-export sub-parts for callers needing full Radix control. */
export {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@/components/ui/select";
