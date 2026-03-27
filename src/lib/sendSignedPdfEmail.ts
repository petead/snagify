import { Resend } from 'resend'
import { buildPdfFileName } from "@/lib/pdfFileName";

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendSignedPdfEmailParams {
  landlordName: string
  landlordEmail: string
  tenantName: string
  tenantEmail: string
  inspectorName: string
  inspectorEmail: string
  /** When false, landlord/tenant still get the PDF; inspector copy is skipped. Default true. */
  includeInspectorRecipient?: boolean
  agencyName: string
  agencyLogo?: string | null
  primaryColor: string
  propertyAddress: string
  inspectionType: 'check-in' | 'check-out' | string
  buildingName?: string | null
  unitNumber?: string | null
  inspectionDate: string
  pdfUrl: string
  /** When set, email explains a party refused to sign (disputed flow). */
  refusalInfo?: {
    refusedParty: 'landlord' | 'tenant' | 'both'
    refusedReason: string | null
    refusedAt: string
  }
}

export async function sendSignedPdfEmail(params: SendSignedPdfEmailParams) {
  const {
    landlordName, landlordEmail,
    tenantName, tenantEmail,
    inspectorName, inspectorEmail,
    includeInspectorRecipient = true,
    agencyName, agencyLogo, primaryColor,
    propertyAddress, inspectionType, buildingName, unitNumber, inspectionDate,
    pdfUrl,
    refusalInfo,
  } = params

  const pdfRes = await fetch(pdfUrl)
  if (!pdfRes.ok) throw new Error('Failed to fetch PDF from storage')
  const pdfBuffer = await pdfRes.arrayBuffer()
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')

  const fileName = buildPdfFileName(inspectionType, buildingName, unitNumber)

  const typeLabel = inspectionType === 'check-in' ? 'Check-in' : 'Check-out'

  const logoHtml = agencyLogo
    ? `<img src="${agencyLogo}" alt="${agencyName}"
        style="height:44px;border-radius:10px;object-fit:contain;" />`
    : `<span style="font-size:18px;font-weight:800;color:white;">${agencyName}</span>`

  const refusalPartyLabel =
    refusalInfo?.refusedParty === 'both'
      ? 'both the Landlord and the Tenant'
      : refusalInfo?.refusedParty === 'landlord' ? 'the Landlord' : 'the Tenant'

  const buildHtml = (recipientName: string, recipientRole: string) => `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;
      margin:0 auto;padding:32px 24px;">

      <!-- Agency header -->
      <div style="background:${primaryColor};border-radius:16px;
        padding:20px 24px;margin-bottom:24px;">
        ${logoHtml}
      </div>

      <!-- Title -->
      <h2 style="font-size:20px;font-weight:800;color:#1A1A2E;margin:0 0 8px;">
        ${refusalInfo ? 'Refusal to sign recorded' : 'Inspection report signed'}
      </h2>
      <p style="font-size:14px;color:#6B7280;margin:0 0 24px;line-height:1.6;">
        ${refusalInfo
          ? `Hi ${recipientName}, ${
              refusalInfo?.refusedParty === 'both'
                ? `<strong style="color:#1A1A2E;">${refusalPartyLabel}</strong> have refused to sign the inspection report for`
                : `<strong style="color:#1A1A2E;">${refusalPartyLabel}</strong> has refused to sign the inspection report for`
            } <strong style="color:#1A1A2E;">${propertyAddress}</strong>.
        The inspection is marked as disputed.${refusalInfo?.refusedReason
            ? `<br/><br/><span style="color:#1A1A2E;font-weight:600;">Reason given by last party:</span> ${refusalInfo.refusedReason}`
            : ''}
        Please find the report PDF attached for your records.`
          : `Hi ${recipientName}, the inspection report for
        <strong style="color:#1A1A2E;">${propertyAddress}</strong>
        has been signed by all parties. Please find the signed report attached.`}
      </p>

      <!-- Details -->
      <div style="background:#F8F7F4;border-radius:12px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          <tr>
            <td style="color:#9B9BA8;padding:5px 0;">Property</td>
            <td style="color:#1A1A2E;font-weight:600;text-align:right;">
              ${propertyAddress}
            </td>
          </tr>
          <tr>
            <td style="color:#9B9BA8;padding:5px 0;">Inspection type</td>
            <td style="color:#1A1A2E;font-weight:600;text-align:right;">
              ${typeLabel}
            </td>
          </tr>
          <tr>
            <td style="color:#9B9BA8;padding:5px 0;">Date</td>
            <td style="color:#1A1A2E;font-weight:600;text-align:right;">
              ${inspectionDate}
            </td>
          </tr>
          <tr>
            <td style="color:#9B9BA8;padding:5px 0;">Your role</td>
            <td style="color:#1A1A2E;font-weight:600;text-align:right;
              text-transform:capitalize;">
              ${recipientRole}
            </td>
          </tr>
        </table>
      </div>

      <!-- PDF notice -->
      <div style="background:#EDE9FF;border-radius:12px;padding:14px 16px;
        margin-bottom:24px;display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:${primaryColor};
          border-radius:8px;display:flex;align-items:center;justify-content:center;
          flex-shrink:0;">
          <span style="color:white;font-size:14px;font-weight:800;">PDF</span>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#3C2E8A;">
            ${fileName}
          </div>
          <div style="font-size:11px;color:#9A88FD;margin-top:2px;">
            Signed inspection report — keep this for your records
          </div>
        </div>
      </div>

      <!-- Legal -->
      <p style="font-size:11px;color:#9B9BA8;text-align:center;
        line-height:1.5;margin:0;">
        This document is legally binding and verified by SHA-256 hash.<br/>
        Keep this email and the attached PDF for your records.
      </p>

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:16px;
        border-top:1px solid #F3F3F8;text-align:center;
        font-size:11px;color:#C4C4C4;">
        Powered by <a href="https://www.snagify.net"
          style="color:#9A88FD;text-decoration:none;font-weight:600;">Snagify</a>
        · Dubai Property Inspections
      </div>
    </div>
  `

  const recipients = [
    { email: landlordEmail, name: landlordName, role: 'landlord' },
    { email: tenantEmail, name: tenantName, role: 'tenant' },
    ...(includeInspectorRecipient
      ? [{ email: inspectorEmail, name: inspectorName, role: 'inspector' as const }]
      : []),
  ].filter((r) => r.email)

  const emailSubject = refusalInfo
    ? refusalInfo.refusedParty === 'both'
      ? `Both parties refused to sign — ${propertyAddress}`
      : `Report update — refusal recorded — ${propertyAddress}`
    : `Signed inspection report — ${propertyAddress}`

  const results = await Promise.allSettled(
    recipients.map(r =>
      resend.emails.send({
        from: `${agencyName} <noreply@snagify.net>`,
        to: r.email,
        subject: emailSubject,
        html: buildHtml(r.name, r.role),
        attachments: [
          {
            filename: fileName,
            content: pdfBase64,
          },
        ],
      })
    )
  )

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to send PDF to ${recipients[i].email}:`, result.reason)
    }
  })

  return {
    sent: results.filter(r => r.status === 'fulfilled').length,
    total: recipients.length,
  }
}
