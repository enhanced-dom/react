import { omit, pick, isPlainObject } from 'lodash-es'
import React, { createElement, forwardRef, useRef, useCallback, ForwardRefRenderFunction, PropsWithoutRef } from 'react'
import { EventListenerTracker } from '@enhanced-dom/dom'

import { useDynamicMemo, useNowEffect } from './hooks'

// eslint-disable-next-line @typescript-eslint/naming-convention
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

type EventMappingType = Record<string, string> | ((fromPropName: string) => string | null)

const eventMapper = (eventMapping: EventMappingType) => (eventName: string) => {
  if (typeof eventMapping === 'function') {
    return eventMapping(eventName)
  }
  return eventMapping[eventName]
}

const isEventEvaluator = (eventMapping: EventMappingType) => (eventName: string) => {
  return !!eventMapper(eventMapping)(eventName)
}

type CopiedStaticsType<
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
  ReactComponentAttributesType extends PropsWithoutRef<{ className?: string; style?: React.CSSProperties }>,
  WebcomponentAttributesType extends { class?: string; style?: string } = { class?: string; style?: string },
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
  eventMapping?: EventMappingType
  propsTransformer?: (
    props: Partial<PropsWithoutRef<ReactComponentAttributesType>>,
    delegatedAttributeName?: string,
    delegatedAttributesSelector?: (attributeName: string) => boolean,
  ) => WebcomponentAttributesType
  delegatedAttributeName?: string
  delegatedAttributesSelector?: (attributeName: string) => boolean
} & (
  | {
      type: WebcomponentType
      tag?: string
    }
  | {
      type?: WebcomponentType
      tag: NonNullable<string>
    }
)) {
  const elementTag = type?.tag ?? tag
  const mapEvent = eventMapper(eventMapping)
  const WebcomponentWrapper: ForwardRefRenderFunction<
    React.MutableRefObject<any> | React.RefCallback<any>,
    PropsWithoutRef<ReactComponentAttributesType>
  > = (props, ref) => {
    const webComponentRef = useRef<any>()
    const eventListenerRef = useRef<EventListenerTracker>(new EventListenerTracker())
    const isEvent = isEventEvaluator(eventMapping)

    const eventPropNames = Object.keys(props).filter((propName) => isEvent(propName)) as (keyof typeof props)[]
    const eventProps = pick(props, eventPropNames)
    const cachedEventProps = useDynamicMemo(() => eventProps, eventProps)
    const findWebcomponent = useCallback(() => webComponentRef.current, [webComponentRef])

    const registerEventListener = useCallback(() => {
      eventListenerRef.current.unregister({ nodeLocator: findWebcomponent })
      eventListenerRef.current.register({
        hook: (e: Element) => {
          Object.entries(cachedEventProps).forEach(([propName, eventHandler]) => {
            const mappedEvent = mapEvent(propName)
            if (mappedEvent) {
              e.addEventListener(mappedEvent, eventHandler)
            }
          })

          return (e1: Element) => {
            Object.entries(cachedEventProps).forEach(([propName, eventHandler]) => {
              const mappedEvent = mapEvent(propName)
              if (mappedEvent) {
                e1.removeEventListener(mappedEvent, eventHandler)
              }
            })
          }
        },
        nodeLocator: findWebcomponent,
      })
      eventListenerRef.current.refreshSubscriptions()
    }, [eventListenerRef, cachedEventProps, findWebcomponent])

    useNowEffect(registerEventListener)

    const callbackRef = useCallback(
      (node: any) => {
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

    const forwardProps = omit(props, eventPropNames) as Partial<typeof props>

    if (!elementTag) {
      return null
    }
    ensureElementIsRegistered(elementTag, type)

    return createElement(elementTag, {
      ref: callbackRef,
      ...propsTransformer(forwardProps, delegatedAttributeName, delegatedAttributesSelector),
    })
  }

  WebcomponentWrapper.displayName = `withReactAdapter<${elementTag}>`

  const compWithForwardedRef = forwardRef(WebcomponentWrapper) as unknown as React.ComponentType<ReactComponentAttributesType> &
    CopiedStaticsType<WebcomponentElement, WebcomponentType, StaticsType> &
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
  ReactAttributesType extends { className?: string; style?: React.CSSProperties; children?: React.ReactNode; [key: string]: unknown },
  ModifiedAttributesType extends Record<string, unknown> = Record<string, unknown>,
>(
  { style, className, children, ...rest }: ReactAttributesType,
  delegatedAttributeName?: string,
  delegatedAttributesSelector?: (attributeName: string) => boolean,
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
  const transformedAttributes: Record<string, unknown> = {
    class: className,
    style,
    children,
    ...Object.keys(rest).reduce(
      (seed, acc) => ({
        ...seed,
        [acc]: acc === delegatedAttributeName ? rest[acc] : serializeAttribute(rest[acc]),
      }),
      {} as Record<keyof ReactAttributesType, string>,
    ),
  }
  const attributesToForward = delegatedAttributesSelector ? Object.keys(rest).filter(delegatedAttributesSelector) : Object.keys(rest)
  if (!delegatedAttributeName) {
    return transformedAttributes as ModifiedAttributesType
  }
  attributesToForward.forEach((attributeName) => {
    const dataForwardObject: Record<string, any> = transformedAttributes[delegatedAttributeName] ?? {}
    dataForwardObject[attributeName] = transformedAttributes[attributeName]
    delete transformedAttributes[attributeName]
    transformedAttributes[delegatedAttributeName] = dataForwardObject
  })
  if (transformedAttributes[delegatedAttributeName]) {
    transformedAttributes[delegatedAttributeName] = JSON.stringify(transformedAttributes[delegatedAttributeName])
  }

  return transformedAttributes as ModifiedAttributesType
}
