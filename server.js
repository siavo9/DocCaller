const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ CONFIG Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Set BLAND_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in your Vercel environment variables
const BLAND_API_KEY = process.env.BLAND_API_KEY;
const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ HELPERS Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}


// Look up a doctor/clinic phone number via web search
async function lookupPhone(doctorName, specialty) {
  try {
    const query = encodeURIComponent(doctorName + (specialty ? ' ' + specialty : '') + ' scheduling phone number');
    const gKey = process.env.GOOGLE_API_KEY || '';
    const gCx = process.env.GOOGLE_CX || '';
    if (!gKey || !gCx) return null;
    const url = 'https://www.googleapis.com/customsearch/v1?key=' + gKey + '&cx=' + gCx + '&q=' + query + '&num=3';
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.items) {
        for (const item of data.items) {
          const text = (item.snippet || '') + ' ' + (item.title || '');
          const m = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
          if (m) return { phone: m[0], source: item.title || 'Web search' };
        }
      }
    }
  } catch (err) { console.log('Phone lookup error:', err.message); }
  return null;
}

function buildTask(patient, appt) {
  return `You are a professional, friendly medical appointment scheduling assistant. You are calling a medical office on behalf of a patient to schedule an appointment.

PATIENT INFORMATION (provide these details when the office staff asks):
- Patient Full Name: ${patient.name}
- Date of Birth: ${patient.dob}
- Home Address: ${patient.address}
- Patient Phone Number: ${patient.phone}
- Insurance Provider: ${patient.insurance}${patient.memberId ? '\n- Insurance Member ID: ' + patient.memberId : ''}${patient.groupNumber ? '\n- Insurance Group Number: ' + patient.groupNumber : ''}${patient.mrn ? '\n- Medical Record Number (MRN): ' + patient.mrn : ''}

SCHEDULING TIMELINE: ${appt.timeline || "No specific preference — schedule the earliest available."}

YOU ARE CALLING: ${appt.name}${appt.specialty ? ' (' + appt.specialty + ')' : ''}

YOUR INSTRUCTIONS:
1. When someone answers, greet them warmly and say: "Hi, I'm calling to schedule an appointment on behalf of ${patient.name}."
2. If asked who you are, say you are a scheduling assistant helping the patient.
3. Provide the patient's information clearly when requested Ã¢ÂÂ name, date of birth, address, phone, and insurance details.
4. Request the earliest available appointment.
5. Confirm the exact date, time, and office location of the appointment.
6. Ask if there are any forms to complete in advance or anything the patient should bring to the visit.
7. Thank the staff and clearly confirm the final appointment details before ending the call.
8. Be patient if put on hold Ã¢ÂÂ wait quietly.
9. If you reach a phone menu, navigate it to reach the scheduling department.
10. If you reach voicemail, leave a clear message: "Hello, I am calling to schedule an appointment for ${patient.name}. Please call back at ${patient.phone} to confirm the appointment. Thank you."

IMPORTANT: Do NOT claim to be the patient. You are calling ON BEHALF of the patient as their scheduling assistant.
IMPORTANT: When the appointment is confirmed, clearly state the date, time, and location so it is captured in the transcript.`;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ ROUTES Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

// Trigger Bland.ai calls for all appointments
app.post('/api/schedule', async (req, res) => {
  try {
    if (!BLAND_API_KEY) {
      return res.status(500).json({ success: false, error: 'Server misconfigured: missing API key' });
    }

    const { patient, appointments } = req.body;

    if (!patient || !patient.name || !patient.dob || !patient.phone || !patient.insurance) {
      return res.status(400).json({ success: false, error: 'Missing required patient information' });
    }

    if (!appointments || appointments.length === 0) {
      return res.status(400).json({ success: false, error: 'No appointments provided' });
    }

    const calls = [];

    for (const appt of appointments.slice(0, 3)) {
      let phoneNumber = appt.phone ? normalizePhone(appt.phone) : null;

      // If no phone number provided, try web search
      if (!phoneNumber || phoneNumber === '+') {
        const lookup = await lookupPhone(appt.name, appt.specialty);
        if (lookup) {
          phoneNumber = normalizePhone(lookup.phone);
          appt.phoneLookedUp = true;
          appt.phoneSource = lookup.source;
        } else {
          calls.push({
            callId: null,
            doctorName: appt.name,
            phone: 'Not found',
            error: 'Could not find a phone number for "' + appt.name + '". Please enter the number manually.'
          });
          continue;
        }
      }

      const task = buildTask(patient, appt);

      const response = await fetch('https://api.bland.ai/v1/calls', {
        method: 'POST',
        headers: {
          'authorization': BLAND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          task,
          voice: 'june',
          max_duration: 60,
          wait_for_greeting: true,
          record: false,
          amd: true,
          language: 'en'
        })
      });

      const data = await response.json();

      if (data.call_id) {
        calls.push({
          callId: data.call_id,
          doctorName: appt.name,
          phone: appt.phone || phoneNumber || 'unknown',
          phoneLookedUp: appt.phoneLookedUp || false,
          phoneSource: appt.phoneSource || null
        });
      } else {
        calls.push({
          callId: null,
          doctorName: appt.name,
          phone: appt.phone,
          error: data.message || 'Failed to initiate call'
        });
      }
    }

    res.json({ success: true, calls });

  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate calls. Please try again.' });
  }
});

// Get call status from Bland.ai
app.get('/api/call-status/:callId', async (req, res) => {
  try {
    if (!BLAND_API_KEY) {
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const { callId } = req.params;
    const response = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: { 'authorization': BLAND_API_KEY }
    });
    const data = await response.json();
    res.json({
      status: data.status,
      completed: data.completed,
      summary: data.summary || null,
      transcript: data.concatenated_transcript || null,
      call_length: data.call_length || null,
      answered_by: data.answered_by || null
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check call status' });
  }
});

// Catch-all Ã¢ÂÂ serve index.html
// Send results email via Resend
app.post('/api/send-results', async (req, res) => {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return res.status(500).json({ success: false, error: 'Email service not configured' });
    }

    const { email, patientName, results } = req.body;

    if (!email || !results || !Array.isArray(results)) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Build the email HTML
    let resultsHtml = '';
    results.forEach((r) => {
      const statusColor = r.status === 'complete' ? '#1a6620' : r.status === 'voicemail' ? '#5a3a8a' : '#a03030';
      const statusLabel = r.status === 'complete' ? 'Scheduled' : r.status === 'voicemail' ? 'Voicemail Left' : 'Could Not Schedule';
      const statusIcon = r.status === 'complete' ? '&#x2705;' : r.status === 'voicemail' ? '&#x1F4EC;' : '&#x274C;';

      resultsHtml += `
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid #e8f0f8;">
            <strong style="color:#1a3a5c;font-size:15px;">${r.doctorName}</strong><br>
            <span style="color:#7a9aba;font-size:13px;">${r.phone}</span>
          </td>
          <td style="padding:14px 18px;border-bottom:1px solid #e8f0f8;text-align:center;">
            <span style="color:${statusColor};font-weight:600;font-size:13px;">${statusIcon} ${statusLabel}</span>
          </td>
          <td style="padding:14px 18px;border-bottom:1px solid #e8f0f8;color:#2d4a6b;font-size:13px;">
            ${r.details || 'No additional details.'}${r.callId ? '<br><a href="https://doccaller.app/transcript/' + r.callId + '" style="color:#4a90d9;text-decoration:underline;font-size:12px;">View transcript</a>' : ''}
          </td>
        </tr>`;
    });

    const htmlBody = `
    <div style="font-family:'Inter',Arial,sans-serif;max-width:640px;margin:0 auto;background:#f0f4f8;padding:30px 20px;">
      <div style="background:linear-gradient(135deg,#1a3a5c 0%,#254d80 100%);border-radius:12px 12px 0 0;padding:24px 30px;">
        <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">DocCaller</h1>
        <p style="color:#a8c4e0;margin:6px 0 0;font-size:14px;">Appointment Scheduling Results</p>
      </div>
      <div style="background:white;border-radius:0 0 12px 12px;padding:28px 30px;border:1px solid #d8e8f5;border-top:none;">
        <p style="color:#2d4a6b;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Hi${patientName ? ' ' + patientName : ''},<br><br>
          Here are the results from your DocCaller scheduling session:
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fafcff;border:1px solid #d8e8f5;border-radius:8px;">
          <thead>
            <tr style="background:#e8f4fd;">
              <th style="padding:12px 18px;text-align:left;color:#1a3a5c;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;">Doctor / Clinic</th>
              <th style="padding:12px 18px;text-align:center;color:#1a3a5c;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;">Status</th>
              <th style="padding:12px 18px;text-align:left;color:#1a3a5c;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${resultsHtml}
          </tbody>
        </table>
        <p style="color:#8a9aaa;font-size:12px;margin:24px 0 0;line-height:1.6;">
          This email was sent by DocCaller. If an appointment was scheduled, please make note of the date, time, and location above. If the AI left a voicemail or could not schedule, you may need to call the office directly.
        </p>
      </div>
    </div>`;

    await ses.send(new SendEmailCommand({
      Source: 'DocCaller <results@doccaller.app>',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Your DocCaller Appointment Results' },
        Body: { Html: { Data: htmlBody } }
      }
    }));

    res.json({ success: true });

  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send results email.' });
  }
});

// Transcript viewer page
app.get('/transcript/:callId', async (req, res) => {
  try {
    if (!BLAND_API_KEY) {
      return res.status(500).send('Server misconfigured');
    }

    const { callId } = req.params;
    const response = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      headers: { 'authorization': BLAND_API_KEY }
    });
    const data = await response.json();

    const transcript = data.concatenated_transcript || 'No transcript available for this call.';
    const doctorName = data.to ? data.to : 'Unknown';
    const callLength = data.call_length ? `${Math.round(data.call_length / 60 * 10) / 10} min` : 'N/A';
    const callStatus = data.status || 'unknown';

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Transcript - DocCaller</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f0f4f8; color: #1a2e4a; min-height: 100vh; }
    header { background: linear-gradient(135deg, #1a3a5c 0%, #254d80 100%); padding: 24px 40px; }
    header h1 { color: white; font-size: 22px; font-weight: 700; }
    header p { color: #a8c4e0; font-size: 13px; margin-top: 4px; }
    .container { max-width: 740px; margin: 32px auto 60px; padding: 0 20px; }
    .meta { background: white; border: 1px solid #d8e8f5; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; display: flex; gap: 32px; flex-wrap: wrap; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label { font-size: 11px; font-weight: 500; color: #5a7a9a; text-transform: uppercase; letter-spacing: 0.4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: #1a3a5c; }
    .transcript-card { background: white; border: 1px solid #d8e8f5; border-radius: 12px; padding: 28px; }
    .transcript-title { font-size: 15px; font-weight: 600; color: #1a3a5c; margin-bottom: 18px; }
    .transcript-text { font-size: 14px; line-height: 1.8; color: #2d4a6b; white-space: pre-wrap; word-wrap: break-word; }
    .back-link { display: inline-block; margin-bottom: 20px; color: #4a90d9; text-decoration: none; font-size: 14px; font-weight: 500; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <h1>DocCaller</h1>
    <p>Call Transcript</p>
  </header>
  <div class="container">
    <a href="/" class="back-link">&larr; Back to DocCaller</a>
    <div class="meta">
      <div class="meta-item">
        <span class="meta-label">Called</span>
        <span class="meta-value">${doctorName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Duration</span>
        <span class="meta-value">${callLength}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Status</span>
        <span class="meta-value">${callStatus}</span>
      </div>
    </div>
    <div class="transcript-card">
      <div class="transcript-title">Full Transcript</div>
      <div class="transcript-text">${transcript.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>
  </div>
</body>
</html>`);

  } catch (error) {
    console.error('Transcript error:', error);
    res.status(500).send('Failed to load transcript.');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ START Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DocCaller running on port ${PORT}`);
});

module.exports = app;
