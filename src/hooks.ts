import { useEffect, useRef, useState } from 'react'

export const useDynamicMemo = <ResultType>(fn: () => ResultType, deps: Record<string, any>) => {
  /* like useMemo, but the dependencies are an object instead of an array. The object is neglected (pointer-wise),
    and instead, we compare the key-value pairs inside the object with the last instance
    */
  const resultRef = useRef<ResultType>(fn())
  const depsRef = useRef<Record<string, any>>({})
  const currentDepsFields = Object.keys(deps)
  const oldDepsFields = Object.keys(depsRef.current)
  if (currentDepsFields.length === oldDepsFields.length && currentDepsFields.every((f) => oldDepsFields.includes(f))) {
    if (currentDepsFields.every((f) => deps[f] === depsRef.current[f])) {
      return resultRef.current
    }
  }
  resultRef.current = fn()
  depsRef.current = deps
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
  }, [...deps, skipTrigger, fn])
}

export const useIncrementalObjectDiff = (obj: Record<string, any>) => {
  const oldObject = useRef({})
  const differentKeys = Object.keys(obj).reduce((diffKeys, key) => {
    if (!diffKeys.includes(key)) {
      diffKeys = [...diffKeys, key]
    } else if (obj[key] === oldObject.current[key]) {
      diffKeys = diffKeys.filter((k) => k !== key)
    }
    return diffKeys
  }, Object.keys(oldObject.current))
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
