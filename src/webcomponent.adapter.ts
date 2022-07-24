import omit from 'lodash.omit'
import pick from 'lodash.pick'
import React, { createElement, forwardRef, useRef, useCallback, useMemo } from 'react'
import isPlainObject from 'lodash.isplainobject'
import { EventListenerTracker } from '@enhanced-dom/webcomponent'

import { useDynamicMemo, useNowEffect } from './hooks'

type WebcomponentPrototype<WebcomponentElement extends HTMLElement, ConstructorArgsTypes extends any[] = any[]> = {
  new (...args: ConstructorArgsTypes): WebcomponentElement
  renderer?: any
  [key: string]: any
} & (
  | {
      register: () => void
      tag: string
    }
  | {
      register?: never
      tag?: never
    }
)

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

const ensureElementIsRegistered = <
  WebcomponentElement extends HTMLElement,
  ConstructorArgsTypes extends any[],
  WebcomponentType extends WebcomponentPrototype<WebcomponentElement, ConstructorArgsTypes>,
>(
  tag: string,
  type?: WebcomponentType,
) => {
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
  delegatedAttributeName = withReactAdapter.defaultDelegatedAttributeName,
  delegatedAttributesSelector = withReactAdapter.defaultDelegatedAttributesSelector,
}: {
  hoistedProps?: StaticsType[]
  eventMapping?: EventMapping
  propsTransformer?: (
    props: Partial<ReactAttributesType>,
    delegatedAttributeName?: string,
    delegatedAttributesSelector?: (attributeName: string) => boolean,
  ) => ModifiedAttributesType
  delegatedAttributeName?: string
  delegatedAttributesSelector?: (attributeName: string) => boolean
} & (
  | {
      type: WebcomponentType
      tag?: string
    }
  | {
      type?: WebcomponentType
      tag: string
    }
)) {
  const elementTag = type?.tag ?? tag
  const WebcomponentWrapper = (props: ReactAttributesType, ref?: React.MutableRefObject<any> | React.RefCallback<any>) => {
    ensureElementIsRegistered(elementTag, type)
    const webComponentRef = useRef<any>()
    const eventListenerRef = useRef<EventListenerTracker>(new EventListenerTracker())
    const isEvent = isEventEvaluator(eventMapping)
    const mapEvent = useMemo(() => eventMapper(eventMapping), [eventMapping])

    const eventPropNames = Object.keys(props).filter((propName) => isEvent(propName))
    const eventProps = pick(props, eventPropNames)
    const cachedEventProps = useDynamicMemo(() => eventProps, eventProps)
    const findWebcomponent = useCallback(() => webComponentRef.current, [webComponentRef])

    useNowEffect(() => {
      eventListenerRef.current.unregister({ nodeLocator: findWebcomponent })
      eventListenerRef.current.register({
        hook: (e: Element) => {
          Object.entries(cachedEventProps).forEach(([propName, eventHandler]) => {
            e.addEventListener(mapEvent(propName), eventHandler)
          })

          return (e1: Element) => {
            Object.entries(cachedEventProps).forEach(([propName, eventHandler]) => {
              e1.removeEventListener(mapEvent(propName), eventHandler)
            })
          }
        },
        nodeLocator: findWebcomponent,
      })
    }, [eventListenerRef, cachedEventProps, findWebcomponent, mapEvent])

    const callbackRef = useCallback(
      (node) => {
        if (node !== null) {
          webComponentRef.current = node
          if (ref) {
            if (typeof ref === 'function') {
              ref(node)
            } else {
              ref.current = node
            }
          }
          eventListenerRef.current.refreshSubscriptions()
        }
      },
      [ref, webComponentRef, eventListenerRef],
    )

    const forwardProps = omit(props, eventPropNames)
    return createElement(elementTag, {
      ref: callbackRef,
      ...propsTransformer(forwardProps, delegatedAttributeName, delegatedAttributesSelector),
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
withReactAdapter.defaultDelegatedAttributeName = 'delegated'
withReactAdapter.defaultDelegatedAttributesSelector = () => false
withReactAdapter.defaultPropsTransformer = <
  ReactAttributesType extends { className?: string; style?: React.CSSProperties; children?: React.ReactNode },
  ModifiedAttributesType = Record<string, string>,
>(
  { style, className, children, ...rest }: ReactAttributesType,
  delegatedAttributeName: string,
  delegatedAttributesSelector: (attributeName: string) => boolean,
) => {
  const serializeAttribute = (value: any) => {
    if (Array.isArray(value) || isPlainObject(value) || value === null) {
      return JSON.stringify(value)
    }
    if (typeof value === 'boolean') {
      return value ? '' : undefined
    }
    return value
  }
  const transformedAttributes = {
    className,
    style,
    children,
    ...Object.keys(rest).reduce(
      (seed, acc) => ({
        ...seed,
        [acc]: serializeAttribute(rest[acc]),
      }),
      {} as Record<keyof ReactAttributesType, string>,
    ),
  } as unknown as ModifiedAttributesType
  const attributesToForward = Object.keys(rest).filter(delegatedAttributesSelector)
  attributesToForward.forEach((attributeName) => {
    const dataForwardObject: Record<string, any> = transformedAttributes[delegatedAttributeName] ?? {}
    dataForwardObject[attributeName] = transformedAttributes[attributeName]
    delete transformedAttributes[attributeName]
    transformedAttributes[delegatedAttributeName] = dataForwardObject
  })
  if (transformedAttributes[delegatedAttributeName]) {
    transformedAttributes[delegatedAttributeName] = JSON.stringify(transformedAttributes[delegatedAttributeName])
  }

  return transformedAttributes
}
