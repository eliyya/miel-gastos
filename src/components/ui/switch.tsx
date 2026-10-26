'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { cn } from 'cn'

import styles from './switch.module.css'

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
    return (
        <SwitchPrimitive.Root
            {...props}
            data-slot="switch"
            className={cn(
                'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted p-0.5 transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                styles.root,
                className,
            )}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    'pointer-events-none block size-4 rounded-full bg-card shadow-sm transition-transform',
                    styles.thumb,
                )}
            />
        </SwitchPrimitive.Root>
    )
}
