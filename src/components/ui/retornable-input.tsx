'use client'

import { cn } from 'cn'
import { Undo2 } from 'lucide-react'
import { useId, useRef, type ComponentProps } from 'react'

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group'
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
    ComponentProps<typeof InputGroupInput>,
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
            <InputGroup className={cn(edited && 'border-ring')}>
                <InputGroupInput
                    {...props}
                    ref={inputRef}
                    id={inputId}
                    type={type}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    aria-describedby={[describedBy, `${inputId}-edited`].filter(Boolean).join(' ')}
                    onChange={event => onValueChange(event.currentTarget.value)}
                />
                {edited && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="icon-sm"
                            disabled={disabled || readOnly}
                            aria-label={`Restaurar ${label}`}
                            title="Restaurar el valor guardado"
                            onClick={() => {
                                onValueChange(originalValue!)
                                inputRef.current?.focus()
                            }}
                        >
                            <Undo2 aria-hidden="true" />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        </div>
    )
}
