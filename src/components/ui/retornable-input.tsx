'use client'

import { cn } from 'cn'
import { Undo2 } from 'lucide-react'
import { useId, useRef, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { InputActionButton } from '@/components/ui/input-action-button'
import { Label } from '@/components/ui/label'

export function isInputEdited(value: string, originalValue: string, type = 'text') {
    // Formatting a number differently does not change the value that will be saved.
    if (type === 'number' && value.trim() && originalValue.trim()) {
        const current = Number(value)
        const original = Number(originalValue)
        if (Number.isFinite(current) && Number.isFinite(original)) return current !== original
    }
    return value !== originalValue
}

type RetornableInputProps = Omit<
    ComponentProps<typeof Input>,
    'value' | 'defaultValue' | 'onChange' | 'ref'
> & {
    label: string
    value: string
    originalValue?: string
    onValueChange: (value: string) => void
}

export function RetornableInput({
    label,
    value,
    originalValue,
    onValueChange,
    id,
    type = 'text',
    disabled,
    readOnly,
    className,
    'aria-describedby': describedBy,
    ...props
}: RetornableInputProps) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const inputRef = useRef<HTMLInputElement>(null)
    const edited = originalValue !== undefined && isInputEdited(value, originalValue, type)

    return (
        <div className="grid min-w-0 gap-2 text-sm" data-edited={edited}>
            <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={inputId} className="font-normal leading-normal">
                    {label}
                </Label>
                <span id={`${inputId}-edited`} className="text-xs text-honey" aria-live="polite">
                    {edited ? 'Modificado' : ''}
                </span>
            </div>
            <div className="relative">
                <Input
                    {...props}
                    ref={inputRef}
                    id={inputId}
                    type={type}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    className={cn(edited && 'border-ring pr-12', className)}
                    aria-describedby={[describedBy, `${inputId}-edited`].filter(Boolean).join(' ')}
                    onChange={event => onValueChange(event.currentTarget.value)}
                />
                {edited && (
                    <InputActionButton
                        disabled={disabled || readOnly}
                        aria-label={`Restaurar ${label}`}
                        title="Restaurar el valor guardado"
                        onClick={() => {
                            onValueChange(originalValue!)
                            inputRef.current?.focus()
                        }}
                    >
                        <Undo2 aria-hidden="true" />
                    </InputActionButton>
                )}
            </div>
        </div>
    )
}
