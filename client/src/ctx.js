import { createContext, useContext } from 'react'

/** Everything the screens share: settings, strings, the resolved "today", and the data. */
export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)
