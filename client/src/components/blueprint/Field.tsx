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
 * Field wrapper: panel ground, line-strong border (-> runway-red on error),
 * square, height 2.625rem, pad 0 .65rem. Input body-s 14px strong, no outline.
 * Label is a mono uppercase runway-label. Hint caption muted; error caption
 * runway-red. Focus -> signal border + ring, matching `.runway-input`.
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
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-runway-faint"
          >
            {label}
          </label>
        ) : null}

        <div
          className={cn(
            "flex h-[2.625rem] items-center gap-2 rounded-none border border-runway-line-strong bg-runway-panel px-[0.65rem] transition-shadow duration-200 ease-standard",
            "focus-within:border-runway-signal focus-within:ring-1 focus-within:ring-runway-signal",
            hasError &&
              "border-runway-red focus-within:border-runway-red focus-within:ring-runway-red",
            disabled && "opacity-45",
            fieldClassName,
          )}
        >
          {leading ? (
            <span className="flex shrink-0 items-center text-runway-faint">
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
              "h-full w-full min-w-0 bg-transparent text-body-s font-medium text-runway-text",
              "outline-none placeholder:font-normal placeholder:text-runway-faint",
              "disabled:cursor-not-allowed",
              className,
            )}
            {...props}
          />

          {trailing ? (
            <span className="flex shrink-0 items-center text-runway-faint">
              {trailing}
            </span>
          ) : null}
        </div>

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
  },
);
Field.displayName = "Field";
