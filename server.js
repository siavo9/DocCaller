const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ CONFIG Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Set BLAND_API_KEY in your Vercel environment variables
const BLAND_API_KEY = process.env.BLAND_API_KEY;

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
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ START Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DocCaller running on port ${PORT}`);
});

module.exports = app;
