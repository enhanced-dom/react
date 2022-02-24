import omit from 'lodash.omit'
import React, { createElement, forwardRef, useEffect, useRef, useCallback } from 'react'
import isPlainObject from 'lodash.isplainobject'

type WebcomponentPrototype<WebcomponentElement extends HTMLElement, ConstructorArgsTypes extends any[] = any[]> = {
  new(...args: ConstructorArgsTypes): WebcomponentElement
  renderer?: any
  [key: string]: any
} & ({
  register: () => void
  tag: string
} | {
  register?: never
  tag?: never
})

type EventMapping = Record<string, string> | ((fromPropName: string) => string | null)

const eventMapper = (eventMapping: EventMapping) => (eventName?: string) => {
  if (typeof eventMapping === 'function') {
    return eventMapping(eventName)
  }
  return eventMapping[eventName]
}

const isEventEvaluator = (eventMapping: EventMapping) => (eventName?: string) => {
  return !!eventMapper(eventMapping)(eventName)
}

type CopiedStatics<
  WebcomponentElement extends HTMLElement,
  S extends WebcomponentPrototype<WebcomponentElement>,
  StaticsType extends string,
  > = {
    [key in StaticsType]: S[key]
  }

const ensureElementIsRegistered = <WebcomponentElement extends HTMLElement, ConstructorArgsTypes extends any[],
  WebcomponentType extends WebcomponentPrototype<WebcomponentElement, ConstructorArgsTypes>>(tag: string, type?: WebcomponentType) => {
  if (type) {
    if (type.register) {
      type.register()
    } else if (!window.customElements.get(tag)) {
      window.customElements.define(tag, type)
    }
  }
}

export function withReactAdapter<
  WebcomponentElement extends HTMLElement,
  ConstructorArgsTypes extends any[],
  WebcomponentType extends WebcomponentPrototype<WebcomponentElement, ConstructorArgsTypes>,
  ReactAttributesType extends { className?: string; style?: React.CSSProperties },
  ModifiedAttributesType = Record<string, string>,
  StaticsType extends string = 'renderer',
  ExtraStatics extends Record<string, any> = Record<string, AnalyserNode>,
  >({
    type,
    tag,
    hoistedProps = ['renderer'] as StaticsType[],
    eventMapping = withReactAdapter.defaultEventMapping,
    propsTransformer = withReactAdapter.defaultPropsTransformer,
  }: {
    hoistedProps?: StaticsType[]
    eventMapping?: EventMapping
    propsTransformer?: (props: Partial<ReactAttributesType>) => ModifiedAttributesType
  } & ({
    type: WebcomponentType
    tag?: string
  } | {
    type?: WebcomponentType
    tag: string 
  })) {
    const elementTag = type?.tag ?? tag
    const WebcomponentWrapper = (props: ReactAttributesType, ref?: React.Ref<any>) => {
      ensureElementIsRegistered(elementTag, type)
      const webComponentRef = useRef<any>()
      const isEvent = isEventEvaluator(eventMapping)
      const mapEvent = eventMapper(eventMapping)

      const eventProps = Object.keys(props).filter((propName) => isEvent(propName))
      const forwardProps = omit(props, eventProps)

      const callbackRef = useCallback(
        (node) => {
          if (node !== null) {
            webComponentRef.current = node
            if (ref) {
              if (typeof ref === 'function') {
                ref(node)
              } else {
                ; (ref as any).current = node
              }
            }

            eventProps.forEach((propName) => {
              webComponentRef.current.addEventListener(mapEvent(propName), props[propName])
            })
          }
        },
        [eventProps, mapEvent, props, ref, webComponentRef],
      )

      useEffect(() => {
        return () => {
          if (webComponentRef.current) {
            eventProps.forEach((propName) => {
              webComponentRef.current.removeEventListener(mapEvent(propName), props[propName])
            })
          }
        }
      }, [webComponentRef, eventProps, mapEvent, props])

      return createElement(elementTag, {
        ref: callbackRef,
        ...forwardProps,
        ...propsTransformer(forwardProps),
      })
    }

    WebcomponentWrapper.displayName = `withReactAdapter<${elementTag}>`

    const compWithForwardedRef = forwardRef(WebcomponentWrapper) as unknown as React.ComponentType<ReactAttributesType> &
      CopiedStatics<WebcomponentElement, WebcomponentType, StaticsType> &
      ExtraStatics
    if (type) {
      hoistedProps.forEach((hoistedProp) => {
        Object.defineProperty(compWithForwardedRef, hoistedProp, { value: type[hoistedProp], writable: false })
      })
    }
    return compWithForwardedRef
  }

  withReactAdapter.defaultEventMapping = (fromPropName: string) =>
    /on[A-Z]+/.test(fromPropName) ? fromPropName.substring(2).toLowerCase() : null
  withReactAdapter.defaultPropsTransformer = <
    ReactAttributesType extends { className?: string; style?: React.CSSProperties; children?: React.ReactNode },
    ModifiedAttributesType = Record<string, string>,
    >({
      style,
      className,
      children,
      ...rest
    }: ReactAttributesType) =>
  ({
    className,
    style,
    children,
    ...Object.keys(rest).reduce(
      (seed, acc) => ({ ...seed, [acc]: Array.isArray(rest[acc]) || isPlainObject(rest[acc]) ? JSON.stringify(rest[acc]) : rest[acc] }),
      {} as Record<keyof ReactAttributesType, string>,
    ),
  } as unknown as ModifiedAttributesType
)
