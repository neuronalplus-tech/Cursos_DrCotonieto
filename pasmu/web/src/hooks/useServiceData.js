import { useEffect, useState } from 'react'

export default function useServiceData(loader, user, parameter) {
  const requestKey = [
    user?.authUserId || user?.name || 'anonymous',
    user?.membershipId ?? '',
    user?.roleId ?? user?.role ?? '',
    user?.unitId ?? '',
    user?.programId ?? '',
    parameter ?? ''
  ].join(':')
  const [state, setState] = useState({ requestKey: null, data: null, loading: true, error: null })

  useEffect(() => {
    let active = true
    setState({ requestKey, data: null, loading: true, error: null })

    Promise.resolve()
      .then(() => loader(user, parameter))
      .then((data) => {
        if (active) setState({ requestKey, data, loading: false, error: null })
      })
      .catch((error) => {
        if (active) {
          const message = typeof error?.message === 'string' && error.message.trim()
            ? error.message
            : typeof error === 'string' && error.trim()
              ? error
              : 'No se pudieron cargar los datos por un error inesperado.'
          setState({
            requestKey,
            data: null,
            loading: false,
            error: message
          })
        }
      })

    return () => {
      active = false
    }
  }, [loader, user, parameter, requestKey])

  if (state.requestKey !== requestKey) {
    return { data: null, loading: true, error: null }
  }

  return state
}
