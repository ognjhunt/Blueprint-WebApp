import * as React from "react";

import { cn } from "@/lib/utils";

export interface FieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Caption-size 600 label rendered above the field. */
  label?: React.ReactNode;
  /** Muted helper text shown below the field (suppressed when `error` is set). */
  hint?: React.ReactNode;
  /** Blocker-fg error text shown below the field. Toggles the error border + a11y state. */
  error?: React.ReactNode;
  /** Element rendered inside the field, before the input (e.g. a lucide icon). */
  leading?: React.ReactNode;
  /** Element rendered inside the field, after the input (e.g. a lucide icon or unit). */
  trailing?: React.ReactNode;
  /** Class applied to the outer wrapper (label + field + message). */
  containerClassName?: string;
  /** Class applied to the bordered field wrapper. */
  fieldClassName?: string;
}

/**
 * Field — Blueprint text input.
 *
 * Field wrapper: white bg, #c8bfac border (-> #9b3027 on error), radius xs (2px),
 * height 2.625rem, pad 0 .65rem. Input body-s 14px strong, no outline. Label caption
 * 600. Hint caption muted; error caption blocker-fg. Focus -> brass ring.
 */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  (
    {
      id,
      label,
      hint,
      error,
      leading,
      trailing,
      className,
      containerClassName,
      fieldClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const hasError = Boolean(error);

    return (
      <div className={cn("flex w-full flex-col gap-1.5", containerClassName)}>
        {label ? (
          <label
            htmlFor={inputId}
            className="text-caption font-semibold text-ink-800"
          >
            {label}
          </label>
        ) : null}

        <div
          className={cn(
            "flex h-[2.625rem] items-center gap-2 rounded-xs border border-line-strong bg-white px-[0.65rem] transition-shadow duration-200 ease-standard",
            "focus-within:border-brass-deep focus-within:ring-2 focus-within:ring-brass-deep/60",
            hasError &&
              "border-block-fg focus-within:border-block-fg focus-within:ring-block-fg/50",
            disabled && "opacity-45",
            fieldClassName,
          )}
        >
          {leading ? (
            <span className="flex shrink-0 items-center text-ink-400">
              {leading}
            </span>
          ) : null}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={
              hasError ? errorId : hint ? hintId : undefined
            }
            className={cn(
              "h-full w-full min-w-0 bg-transparent text-body-s font-medium text-ink-900",
              "outline-none placeholder:font-normal placeholder:text-ink-400",
              "disabled:cursor-not-allowed",
              className,
            )}
            {...props}
          />

          {trailing ? (
            <span className="flex shrink-0 items-center text-ink-400">
              {trailing}
            </span>
          ) : null}
        </div>

        {hasError ? (
          <p id={errorId} className="text-caption text-block-fg">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-caption text-ink-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = "Field";
