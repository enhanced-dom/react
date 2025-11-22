// TODO: when eslint plugin for refs (currently v7.0.0) gets 'fixed', these eslint-disable exceptions should be re-visited
import { useEffect, useRef, useState } from 'react'

export const useDynamicMemo = <ResultType>(fn: () => ResultType, deps: Record<string, any>) => {
  /* like useMemo, but the dependencies are an object instead of an array. The object is neglected (pointer-wise),
    and instead, we compare the key-value pairs inside the object with the last instance
    */
  const resultRef = useRef<ResultType>(fn())
  const depsRef = useRef<Record<string, any>>({})
  const currentDepsFields = Object.keys(deps)
  // eslint-disable-next-line react-hooks/refs
  const oldDepsFields = Object.keys(depsRef.current)
  if (currentDepsFields.length === oldDepsFields.length && currentDepsFields.every((f) => oldDepsFields.includes(f))) {
    // eslint-disable-next-line react-hooks/refs
    if (currentDepsFields.every((f) => deps[f] === depsRef.current[f])) {
      // eslint-disable-next-line react-hooks/refs
      return resultRef.current
    }
  }
  // eslint-disable-next-line react-hooks/refs
  resultRef.current = fn()
  // eslint-disable-next-line react-hooks/refs
  depsRef.current = deps
  // eslint-disable-next-line react-hooks/refs
  return resultRef.current
}

export const useNowEffect = (fn: () => void, deps: any[] = []) => {
  const skipTrigger = useRef<boolean>(true)

  if (skipTrigger.current === true) {
    fn()
  }

  useEffect(() => {
    if (skipTrigger.current) {
      skipTrigger.current = false
    } else {
      fn()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skipTrigger, fn])
}

export const useIncrementalObjectDiff = (obj: Record<string, any>) => {
  const oldObject = useRef({})
  // eslint-disable-next-line react-hooks/refs
  const differentKeys = Object.keys(obj).reduce((diffKeys, key) => {
    if (!diffKeys.includes(key)) {
      diffKeys = [...diffKeys, key]
    } else if (obj[key] === oldObject.current[key]) {
      diffKeys = diffKeys.filter((k) => k !== key)
    }
    return diffKeys
    // eslint-disable-next-line react-hooks/refs
  }, Object.keys(oldObject.current))
  // eslint-disable-next-line react-hooks/refs
  oldObject.current = obj
  return differentKeys
}

// inspired by https://usehooks.com/usedebounce
export const useDebouncedMemo = <T>(value: T, delay: number) => {
  /** like useMemo, but the value is returned after a certain delay */
  const [currentValue, setCurrentValue] = useState(value)
  const debounceCancelRef = useRef<() => void>()
  useEffect(() => {
    debounceCancelRef.current?.()
    const timeout = setTimeout(() => setCurrentValue(value), delay)
    debounceCancelRef.current = () => {
      clearTimeout(timeout)
    }
    return debounceCancelRef.current
  }, [value, delay, debounceCancelRef])
  return currentValue
}
