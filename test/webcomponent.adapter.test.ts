/* global jest, expect, test, describe, beforeEach, afterEach */
import '@testing-library/jest-dom'
import { act, createElement, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { TestComponent } from './test.component'
import { TestWebComponent } from './test.webcomponent'

describe('webcomponent adapter', () => {
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

  test('renders the custom element tag into the DOM', () => {
    act(() => {
      root.render(createElement(TestComponent, null))
    })
    expect(container.querySelector(TestWebComponent.tag)).not.toBeNull()
  })

  test('hoists renderer static from TestWebComponent onto TestComponent', () => {
    expect((TestComponent as any).renderer).toBe(TestWebComponent.renderer)
  })

  test('maps React className prop to class attribute on the custom element', () => {
    act(() => {
      root.render(createElement(TestComponent, { className: 'my-class' } as any))
    })
    const el = container.querySelector(TestWebComponent.tag)
    expect(el).toHaveAttribute('class', 'my-class')
  })

  test('serializes boolean true active prop as empty string attribute', () => {
    act(() => {
      root.render(createElement(TestComponent, { active: true } as any))
    })
    const el = container.querySelector(TestWebComponent.tag)
    expect(el).toHaveAttribute('active', '')
  })

  test('serializes delegated object prop as JSON string attribute', () => {
    const delegated = { width: '100px', label: 'test' }
    act(() => {
      root.render(createElement(TestComponent, { delegated } as any))
    })
    const el = container.querySelector(TestWebComponent.tag)
    expect(el).toHaveAttribute('delegated', JSON.stringify(delegated))
  })

  test('registers click handler for onClick prop via event mapping', () => {
    const handler = jest.fn()
    act(() => {
      root.render(createElement(TestComponent, { onClick: handler } as any))
    })
    const el = container.querySelector(TestWebComponent.tag)!
    el.dispatchEvent(new Event('click'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('does not pass onClick as an attribute on the custom element', () => {
    act(() => {
      root.render(createElement(TestComponent, { onClick: jest.fn() } as any))
    })
    const el = container.querySelector(TestWebComponent.tag)!
    expect(el).not.toHaveAttribute('onClick')
  })

  test('forwards ref to the underlying custom element instance', () => {
    const ref = createRef<TestWebComponent>()
    act(() => {
      root.render(createElement(TestComponent, { ref } as any))
    })
    const el = container.querySelector(TestWebComponent.tag)
    expect(ref.current).toBe(el)
  })

  describe('shadow DOM rendering', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    test('renders a div with width 100px in shadow DOM when isActive is not set', async () => {
      act(() => {
        root.render(createElement(TestComponent, null))
      })
      await act(async () => {
        jest.advanceTimersByTime(20)
      })
      const el = container.querySelector(TestWebComponent.tag)!
      expect(el.shadowRoot?.querySelector('div[width="100px"]')).not.toBeNull()
    })

    test('renders a div with width 50px in shadow DOM when active is truthy', async () => {
      // boolean true serializes to attribute="" which the setter evaluates as truthy
      act(() => {
        root.render(createElement(TestComponent, { active: true } as any))
      })
      await act(async () => {
        jest.advanceTimersByTime(20)
      })
      const el = container.querySelector(TestWebComponent.tag)!
      expect(el.shadowRoot?.querySelector('div[width="50px"]')).not.toBeNull()
    })

    test('always renders a second div with test-class in shadow DOM', async () => {
      act(() => {
        root.render(createElement(TestComponent, null))
      })
      await act(async () => {
        jest.advanceTimersByTime(20)
      })
      const el = container.querySelector(TestWebComponent.tag)!
      expect(el.shadowRoot?.querySelector('div.test-class')).not.toBeNull()
    })

    test('spreads delegated attributes into second shadow DOM div', async () => {
      const delegated = { customRole: 'main', customLabel: 'content' }
      act(() => {
        root.render(createElement(TestComponent, { delegated } as any))
      })
      await act(async () => {
        jest.advanceTimersByTime(20)
      })
      const el = container.querySelector(TestWebComponent.tag)!
      expect(el.shadowRoot?.querySelector('div[customRole="main"][customLabel="content"]')).not.toBeNull()
    })

    test('re-renders shadow DOM with updated width when active prop changes', async () => {
      act(() => {
        root.render(createElement(TestComponent, null))
      })
      await act(async () => {
        jest.advanceTimersByTime(20)
      })
      const el = container.querySelector(TestWebComponent.tag)!
      expect(el.shadowRoot?.querySelector('div[width="100px"]')).not.toBeNull()

      act(() => {
        root.render(createElement(TestComponent, { active: true } as any))
      })
      await act(async () => {
        jest.advanceTimersByTime(20)
      })
      expect(el.shadowRoot?.querySelector('div[width="50px"]')).not.toBeNull()
      expect(el.shadowRoot?.querySelector('div[width="100px"]')).toBeNull()
    })
  })
})
