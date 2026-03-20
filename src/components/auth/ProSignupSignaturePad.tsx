'use client'

import { forwardRef, type ComponentProps } from 'react'
import SignatureCanvas from 'react-signature-canvas'

export type ProSignupSignaturePadProps = ComponentProps<typeof SignatureCanvas>

/** Client-only pad for signup — ref forwarded for clear / isEmpty / getTrimmedCanvas */
export const ProSignupSignaturePad = forwardRef<SignatureCanvas, ProSignupSignaturePadProps>(
  function ProSignupSignaturePad(props, ref) {
    return <SignatureCanvas ref={ref} {...props} />
  }
)
