import { useCallback, useEffect, useState } from 'react'
import { parseHash, type Route } from '../utils/routes'

function readRoute(): Route {
  return parseHash(window.location.hash)
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    function onHashChange() {
      setRoute(readRoute())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const nextHash = `#${path}`
    if (window.location.hash === nextHash) return

    if (options?.replace) {
      const url = `${window.location.pathname}${window.location.search}${nextHash}`
      window.history.replaceState(null, '', url)
      setRoute(parseHash(nextHash))
    } else {
      window.location.hash = path
    }
  }, [])

  return { route, navigate }
}
