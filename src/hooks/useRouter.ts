import { useCallback, useEffect, useState } from 'react'
import { parsePath, type Route } from '../utils/routes'

function readRoute(): Route {
  return parsePath(window.location.pathname)
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    function onPopState() {
      setRoute(readRoute())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (window.location.pathname === path) return

    const url = `${path}${window.location.search}`
    if (options?.replace) {
      window.history.replaceState(null, '', url)
    } else {
      window.history.pushState(null, '', url)
    }
    setRoute(parsePath(path))
  }, [])

  return { route, navigate }
}
