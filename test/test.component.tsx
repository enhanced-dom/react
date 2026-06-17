import { DetailedHTMLProps, HTMLAttributes } from 'react'

import { withReactAdapter } from '../src'
import { TestWebComponent, TestWebComponentAttributes } from './test.webcomponent'

declare type TestComponentProps = TestWebComponentAttributes & DetailedHTMLProps<HTMLAttributes<TestWebComponent>, TestWebComponent>

export const TestComponent = withReactAdapter<TestWebComponent, never[], typeof TestWebComponent, TestComponentProps>({
  type: TestWebComponent,
})
