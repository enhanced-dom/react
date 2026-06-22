/* global jest, expect, test, describe, beforeEach, afterEach */
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useDebouncedCallback, useIncrementalObjectDiff, useDebouncedMemo } from '../src/hooks'

describe('useDebouncedCallback', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    jest.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
  })

  test('debounces calls — fires once after delay with the last args', () => {
    const fn = jest.fn()
    let debounced!: ReturnType<typeof useDebouncedCallback>

    const Component = () => {
      debounced = useDebouncedCallback(fn, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    debounced('a')
    debounced('b')
    debounced('c')
    expect(fn).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })

  test('cancels pending call when fn changes', () => {
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    let debounced!: ReturnType<typeof useDebouncedCallback>
    let setFn!: (f: () => void) => void

    const Component = () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [fn, _setFn] = useState<() => void>(() => fn1)
      setFn = (f) => _setFn(() => f)
      debounced = useDebouncedCallback(fn, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    debounced()
    act(() => {
      setFn(fn2)
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).not.toHaveBeenCalled()
  })

  test('calls the latest fn when invoked after fn change', () => {
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    let debounced!: ReturnType<typeof useDebouncedCallback>
    let setFn!: (f: () => void) => void

    const Component = () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [fn, _setFn] = useState<() => void>(() => fn1)
      setFn = (f) => _setFn(() => f)
      debounced = useDebouncedCallback(fn, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    act(() => {
      setFn(fn2)
    })
    debounced()

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  test('cancels pending call when delay changes', () => {
    const fn = jest.fn()
    let debounced!: ReturnType<typeof useDebouncedCallback>
    let setDelay!: (d: number) => void

    const Component = () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [delay, _setDelay] = useState(200)
      setDelay = _setDelay
      debounced = useDebouncedCallback(fn, delay)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    debounced()
    act(() => {
      setDelay(500)
    })

    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(fn).not.toHaveBeenCalled()
  })

  test('cancels pending call on unmount', () => {
    const fn = jest.fn()
    let debounced!: ReturnType<typeof useDebouncedCallback>

    const Component = () => {
      debounced = useDebouncedCallback(fn, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    debounced()
    act(() => {
      root.unmount()
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(fn).not.toHaveBeenCalled()
  })

  test('leading option fires immediately on first call', () => {
    const fn = jest.fn()
    let debounced!: ReturnType<typeof useDebouncedCallback>

    const Component = () => {
      debounced = useDebouncedCallback(fn, 200, { leading: true, trailing: false })
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    debounced('first')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('first')

    debounced('second')
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('same option values by primitive equality do not recreate the debounced instance', () => {
    const fn = jest.fn()
    let first!: ReturnType<typeof useDebouncedCallback>
    let second!: ReturnType<typeof useDebouncedCallback>
    let rerender!: () => void

    const Component = () => {
      const [tick, setTick] = useState(0)
      rerender = () => setTick((t) => t + 1)
      const d = useDebouncedCallback(fn, 200, { leading: false })
      if (tick === 0) first = d
      else second = d
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })

    act(() => {
      rerender()
    })
    expect(second).toBe(first)
  })
})

describe('useIncrementalObjectDiff', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  test('returns all keys on first render', () => {
    let result!: string[]
    const Component = () => {
      result = useIncrementalObjectDiff({ a: 1, b: 2 })
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    expect(result).toHaveLength(2)
    expect(result).toEqual(expect.arrayContaining(['a', 'b']))
  })

  test('returns empty array when all values are unchanged', () => {
    let result!: string[]
    let rerender!: () => void
    const Component = () => {
      const [, setTick] = useState(0)
      rerender = () => setTick((t) => t + 1)
      result = useIncrementalObjectDiff({ a: 1, b: 2 })
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      rerender()
    })
    expect(result).toEqual([])
  })

  test('returns only the key whose value changed', () => {
    let result!: string[]
    let setObj!: (o: Record<string, any>) => void
    const Component = () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [obj, _setObj] = useState<Record<string, any>>({ a: 1, b: 2 })
      setObj = _setObj
      result = useIncrementalObjectDiff(obj)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setObj({ a: 1, b: 3 })
    })
    expect(result).toEqual(['b'])
  })

  test('includes a newly added key as changed', () => {
    let result!: string[]
    let setObj!: (o: Record<string, any>) => void
    const Component = () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [obj, _setObj] = useState<Record<string, any>>({ a: 1 })
      setObj = _setObj
      result = useIncrementalObjectDiff(obj)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setObj({ a: 1, c: 99 })
    })
    expect(result).toContain('c')
    expect(result).not.toContain('a')
  })

  test('includes a removed key as changed', () => {
    let result!: string[]
    let setObj!: (o: Record<string, any>) => void
    const Component = () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [obj, _setObj] = useState<Record<string, any>>({ a: 1, b: 2 })
      setObj = _setObj
      result = useIncrementalObjectDiff(obj)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setObj({ a: 1 })
    })
    expect(result).toContain('b')
    expect(result).not.toContain('a')
  })
})

describe('useDebouncedMemo', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    jest.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
  })

  test('returns the initial value immediately', () => {
    let result!: string
    const Component = () => {
      result = useDebouncedMemo('hello', 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    expect(result).toBe('hello')
  })

  test('does not update before the delay elapses', () => {
    let result!: string
    let setValue!: (v: string) => void
    const Component = () => {
      const [v, setV] = useState('hello')
      setValue = setV
      result = useDebouncedMemo(v, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setValue('world')
    })
    expect(result).toBe('hello')
  })

  test('updates after the delay elapses', () => {
    let result!: string
    let setValue!: (v: string) => void
    const Component = () => {
      const [v, setV] = useState('hello')
      setValue = setV
      result = useDebouncedMemo(v, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setValue('world')
    })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result).toBe('world')
  })

  test('rapid changes settle on the last value after a single delay', () => {
    let result!: string
    let setValue!: (v: string) => void
    const Component = () => {
      const [v, setV] = useState('a')
      setValue = setV
      result = useDebouncedMemo(v, 200)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setValue('b')
    })
    act(() => {
      setValue('c')
    })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result).toBe('c')
  })

  test('delay change cancels the pending timer and starts a fresh one', () => {
    let result!: number
    let setValue!: (v: number) => void
    let setDelay!: (d: number) => void
    const Component = () => {
      const [v, setV] = useState(1)
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const [delay, _setDelay] = useState(200)
      setValue = setV
      setDelay = _setDelay
      result = useDebouncedMemo(v, delay)
      return null
    }
    act(() => {
      root.render(createElement(Component))
    })
    act(() => {
      setValue(2)
    })
    act(() => {
      setDelay(500)
    })
    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(result).toBe(1)
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(result).toBe(2)
  })
})
