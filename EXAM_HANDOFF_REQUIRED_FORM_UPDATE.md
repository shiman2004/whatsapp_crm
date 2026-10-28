# Sales Exam Handoff Required Form

Before a sales officer moves a lead to **Forwarded to Exam Department**, the CRM now opens a required forwarding form.

Required fields:

- Requirement type: International requirement or Country-specific requirement
- Exam country and exam title
- Exam authority
- Priority: Urgent or Regular work
- Services: Exam material, Mock test, and/or Model study question
- Quotation number
- Client name, email ID, and contact number
- Payment receipt attachment (PDF/image, up to 15 MB)
- Receipt voucher number
- Receipt voucher PDF attachment (up to 15 MB)

Both files are uploaded to the authenticated CRM media endpoint first. The handoff stores signed URLs for the payment receipt and receipt voucher PDF, then creates the Head of Exam inbox item. The Head can view or download both documents before accepting and assigning the request.

Backend validation rejects incomplete or invalid handoffs, so changing the lead stage locally cannot bypass the required information.
