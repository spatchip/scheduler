import nodemailer from 'nodemailer';

// For now, this is a simulation. Later we will replace the implementation
// with a real nodemailer transporter using SMTP credentials.

interface BookingDetails {
  id: number;
  client_name: string;
  client_email: string | null;
  start_time: string;
  end_time: string;
  status?: string;
  service_type?: string | null;
  notes?: string | null;
}

interface StaffDetails {
  name: string;
  email?: string;
}

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  // === SIMULATED EMAIL (console only) ===
  // In production, configure a real transporter:
  //
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT),
  //   secure: true,
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASS,
  //   },
  // });
  //
  // await transporter.sendMail({ from: '"Scheduler" <no-reply@scheduler.example>', to, subject, html: htmlBody });

  console.log('\n' + '='.repeat(60));
  console.log('📧 SIMULATED EMAIL NOTIFICATION');
  console.log('='.repeat(60));
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('-'.repeat(60));
  console.log(htmlBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()); // plain text-ish for console
  console.log('='.repeat(60) + '\n');
}

export async function sendBookingConfirmation(booking: BookingDetails, staff: StaffDetails) {
  if (!booking.client_email) {
    console.log('[Email] No client_email provided for booking confirmation, skipping simulation.');
    return;
  }

  const start = new Date(booking.start_time).toLocaleString();
  const end = new Date(booking.end_time).toLocaleString();

  const subject = `Your sitting with ${staff.name} is confirmed`;

  const html = `
    <h2>Booking Confirmed</h2>
    <p>Dear ${booking.client_name},</p>
    <p>Thank you for booking. Your sitting has been confirmed with <strong>${staff.name}</strong>.</p>
    <ul>
      <li><strong>When:</strong> ${start} — ${end}</li>
      ${booking.service_type ? `<li><strong>Service:</strong> ${booking.service_type}</li>` : ''}
      ${booking.notes ? `<li><strong>Notes:</strong> ${booking.notes}</li>` : ''}
    </ul>
    <p>We look forward to seeing you!</p>
    <p>— The Scheduler Team</p>
  `;

  await sendEmail(booking.client_email, subject, html);
}

export async function sendBookingCancellation(booking: BookingDetails, staff: StaffDetails) {
  if (!booking.client_email) {
    console.log('[Email] No client_email provided for cancellation notice, skipping simulation.');
    return;
  }

  const start = new Date(booking.start_time).toLocaleString();

  const subject = `Your sitting with ${staff.name} has been cancelled`;

  const html = `
    <h2>Booking Cancelled</h2>
    <p>Dear ${booking.client_name},</p>
    <p>We regret to inform you that your sitting with <strong>${staff.name}</strong> scheduled for <strong>${start}</strong> has been cancelled.</p>
    ${booking.service_type ? `<p>Service: ${booking.service_type}</p>` : ''}
    <p>If you would like to reschedule, please visit the booking page again.</p>
    <p>— The Scheduler Team</p>
  `;

  await sendEmail(booking.client_email, subject, html);
}
