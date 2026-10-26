import { cn } from 'cn'
import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'

export function InputActionButton({
    className,
    ...props
}: Omit<ComponentProps<typeof Button>, 'type' | 'variant' | 'size'>) {
    return (
        <Button
            {...props}
            variant="ghost"
            size="icon"
            type="button"
            className={cn(
                'absolute inset-y-0 right-0 flex h-full w-12 items-center justify-center rounded-r-xl text-[#6b4a2b] outline-none hover:text-[#44240b] focus-visible:ring-2 focus-visible:ring-honey',
                className,
            )}
        />
    )
}
