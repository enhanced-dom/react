import { IAbstractNode } from '@enhanced-dom/dom'
import { WebcomponentRenderer, type IRenderingEngine } from '@enhanced-dom/webcomponent'
import { debounce } from 'lodash-es'

export type TestWebComponentAttributes = { active?: boolean; delegated?: Record<string, string | number | boolean> }

export class TestWebComponent extends HTMLElement {
  static get observedAttributes() {
    return ['active', 'delegated']
  }

  static tag = 'enhanced-dom-test'
  static parts = {
    wrapper: 'wrapper',
  }

  static register = () => {
    if (!window.customElements.get(TestWebComponent.tag)) {
      window.customElements.define(TestWebComponent.tag, TestWebComponent)
    }
  }

  static template = ({ active, delegated = {} }: Record<string, any> = {}): IAbstractNode[] => {
    return [
      {
        tag: 'div',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _key: 'div1',
        attributes: {
          width: active ? '50px' : '100px',
          height: '30px',
        },
      },
      {
        tag: 'div',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _key: 'div2',
        attributes: {
          ...delegated,
          class: 'test-class',
        },
      },
    ]
  }
  static renderer: IRenderingEngine = new WebcomponentRenderer('@enhanced-dom/TestWebComponent', TestWebComponent.template)
  private _attributes: Record<string, any> = {}

  private _preRendered = false

  constructor() {
    super()
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' })
    } else {
      this._preRendered = true
    }
  }

  render = debounce(
    () => {
      TestWebComponent.renderer.render(this.shadowRoot, this._attributes)
    },
    10,
    { leading: false, trailing: true },
  )

  connectedCallback() {
    if (!this._preRendered) {
      this.render()
    } else {
      // we skip the rendering, but we mark it
      this._preRendered = false
    }
  }

  get active() {
    return this._attributes.active as boolean
  }
  set active(t: string | boolean) {
    if (typeof t === 'string') {
      this._attributes.active = t === 'true' || t === ''
    } else {
      this._attributes.active = t
    }
  }

  get delegated() {
    return this._attributes.delegated
  }
  set delegated(d: string | Record<string, string | number | boolean>) {
    if (typeof d === 'string') {
      this._attributes.delegated = JSON.parse(d)
    } else {
      this._attributes.delegated = d
    }
  }

  attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    if (oldVal !== newVal) {
      switch (name) {
        case 'active':
          this.active = newVal
          break
        case 'delegated':
          this.delegated = newVal
          break
      }
      this.render()
    }
  }
}
