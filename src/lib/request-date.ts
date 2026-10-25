import 'server-only'
import { connection } from 'next/server'
import { cache } from 'react'

import { mexicoDate } from './statistics'

// Share one business date throughout the request, including streamed components.
// React resets this cache for each server request, so the date stays current.
export const getRequestToday = cache(async () => {
    await connection()
    return mexicoDate(new Date())
})
