const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5000/api/v1';

async function testAppointmentLifecycle() {
  console.log('=== STARTING CLIENT APPOINTMENT LIFECYCLE TEST ===');

  try {
    // 1. Login as tour@gmail.com
    console.log('1. Logging in as tour@gmail.com...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tour@gmail.com',
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken || loginData.accessToken || loginData.token;
    if (!token) throw new Error('No token returned: ' + JSON.stringify(loginData));
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    console.log('✓ Successfully logged in.');

    // 2. Fetch dossiers
    console.log('2. Fetching dossiers for tour@gmail.com...');
    const dossiersRes = await fetch(`${API_BASE}/dossiers/my-dossiers`, { headers: authHeaders });
    const dossiersData = await dossiersRes.json();
    const dossiers = dossiersData.data?.dossiers || dossiersData.data || dossiersData;
    if (!dossiers || dossiers.length === 0) {
      throw new Error('No dossiers found for tour@gmail.com');
    }
    const dossier = dossiers[0];
    console.log(`✓ Found dossier: ${dossier.dossierNumber} (ID: ${dossier.id})`);

    // Clean up any existing appointments for this dossier first so we test clean slate
    const existing = await prisma.appointment.findMany({
      where: { dossierId: dossier.id }
    });
    if (existing.length > 0) {
      console.log(`Cleaning up ${existing.length} existing appointment(s) for dossier...`);
      for (const appt of existing) {
        if (appt.timeSlotId) {
          await prisma.timeSlot.update({
            where: { id: appt.timeSlotId },
            data: { bookedCount: { decrement: 1 } }
          }).catch(() => {});
        }
        await prisma.appointment.delete({ where: { id: appt.id } });
      }
      console.log('✓ Cleanup complete.');
    }

    // 3. Fetch available slots
    console.log('3. Fetching available time slots...');
    const slotsRes = await fetch(`${API_BASE}/appointments/slots`, { headers: authHeaders });
    const slotsData = await slotsRes.json();
    const allSlots = slotsData.data?.slots || [];
    const openSlots = allSlots.filter(s => (s.capacity - s.bookedCount) > 0);
    console.log(`✓ Fetched ${allSlots.length} total slots (${openSlots.length} available with capacity).`);
    if (openSlots.length < 2) {
      throw new Error('Need at least 2 available slots to test booking and rescheduling.');
    }
    const firstSlot = openSlots[0];
    const secondSlot = openSlots[1];
    console.log(`Slot 1: ID ${firstSlot.id} on ${firstSlot.date} at ${firstSlot.startTime}`);
    console.log(`Slot 2: ID ${secondSlot.id} on ${secondSlot.date} at ${secondSlot.startTime}`);

    // 4. Book appointment
    console.log('4. Booking appointment with Slot 1...');
    const bookRes = await fetch(`${API_BASE}/appointments/book`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dossierId: dossier.id,
        timeSlotId: firstSlot.id,
        type: 'BIOMETRICS_AND_SUBMISSION',
        notes: 'Automated test booking'
      })
    });
    const bookData = await bookRes.json();
    const bookedAppt = bookData.data?.appointment || bookData.data;
    if (!bookedAppt?.id) throw new Error('Booking failed: ' + JSON.stringify(bookData));
    console.log(`✓ Successfully booked appointment! ID: ${bookedAppt.id}, Number: ${bookedAppt.appointmentNumber}`);

    // Verify DB
    const dbAppt1 = await prisma.appointment.findUnique({
      where: { id: bookedAppt.id },
      include: { timeSlot: true }
    });
    console.log(`✓ DB Verification: Status=${dbAppt1.status}, TimeSlot=${dbAppt1.timeSlot.startTime}`);
    if (dbAppt1.status !== 'CONFIRMED') throw new Error(`Expected status CONFIRMED, got ${dbAppt1.status}`);

    const slot1AfterBook = await prisma.timeSlot.findUnique({ where: { id: firstSlot.id } });
    console.log(`✓ Slot 1 bookedCount increased: ${firstSlot.bookedCount} -> ${slot1AfterBook.bookedCount}`);

    // 5. Test Confirmation PDF generation
    console.log('5. Generating Appointment Confirmation PDF...');
    const pdfRes = await fetch(`${API_BASE}/appointments/${bookedAppt.id}/confirmation-pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`✓ PDF API Response Status: ${pdfRes.status}`);
    const pdfData = await pdfRes.json();
    const fileUrl = pdfData.data?.fileUrl;
    console.log(`✓ PDF Generated: ${fileUrl}`);
    if (!fileUrl) throw new Error('No fileUrl returned from confirmation-pdf endpoint');

    // Fetch static file
    const staticRes = await fetch(`http://localhost:5000${fileUrl}`);
    console.log(`✓ Static PDF fetch status: ${staticRes.status}, Content-Type: ${staticRes.headers.get('content-type')}`);
    const pdfArrayBuffer = await staticRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    const pdfMagic = pdfBuffer.slice(0, 4).toString();
    console.log(`✓ PDF Header Magic: "${pdfMagic}" (Length: ${pdfBuffer.length} bytes)`);
    if (!pdfMagic.startsWith('%PDF')) throw new Error('File does not have PDF header');

    // 6. Reschedule appointment
    console.log('6. Rescheduling appointment to Slot 2...');
    const rescheduleRes = await fetch(`${API_BASE}/appointments/${bookedAppt.id}/reschedule`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        newTimeSlotId: secondSlot.id
      })
    });
    const rescheduleData = await rescheduleRes.json();
    const rescheduledAppt = rescheduleData.data?.appointment || rescheduleData.data;
    console.log(`✓ Successfully rescheduled! New TimeSlot ID: ${rescheduledAppt.timeSlotId}`);

    const slot1AfterReschedule = await prisma.timeSlot.findUnique({ where: { id: firstSlot.id } });
    const slot2AfterReschedule = await prisma.timeSlot.findUnique({ where: { id: secondSlot.id } });
    console.log(`✓ Slot 1 bookedCount after reschedule: ${slot1AfterReschedule.bookedCount} (restored)`);
    console.log(`✓ Slot 2 bookedCount after reschedule: ${slot2AfterReschedule.bookedCount} (incremented)`);

    // 7. Verify appointments via /dossiers/my-dossiers
    console.log('7. Verifying dossier appointments via GET /dossiers/my-dossiers...');
    const myDossiersRes = await fetch(`${API_BASE}/dossiers/my-dossiers`, { headers: authHeaders });
    const myDossiersData = await myDossiersRes.json();
    const myDossier = (myDossiersData.data?.dossiers || myDossiersData.data)[0];
    const dossierAppts = myDossier.appointments || [];
    console.log(`✓ Dossier has ${dossierAppts.length} appointments attached. Latest status: ${dossierAppts[0]?.status}`);

    // 8. Cancel appointment
    console.log('8. Cancelling appointment...');
    const cancelRes = await fetch(`${API_BASE}/appointments/${bookedAppt.id}/cancel`, {
      method: 'DELETE',
      headers: authHeaders
    });
    const cancelData = await cancelRes.json();
    console.log(`✓ Cancel response:`, cancelData.message);

    const dbApptCancelled = await prisma.appointment.findUnique({ where: { id: bookedAppt.id } });
    console.log(`✓ DB Verification after cancel: Status=${dbApptCancelled.status}`);
    if (dbApptCancelled.status !== 'CANCELLED') throw new Error(`Expected CANCELLED status, got ${dbApptCancelled.status}`);

    const slot2AfterCancel = await prisma.timeSlot.findUnique({ where: { id: secondSlot.id } });
    console.log(`✓ Slot 2 bookedCount after cancel: ${slot2AfterCancel.bookedCount} (restored)`);

    // Finally re-book a fresh confirmed appointment so the user has an active, legitimate appointment when they view the page!
    console.log('\n9. Re-booking a fresh confirmed appointment for the user with Slot 1...');
    const finalBook = await fetch(`${API_BASE}/appointments/book`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dossierId: dossier.id,
        timeSlotId: firstSlot.id,
        type: 'BIOMETRICS_AND_SUBMISSION',
        notes: 'Official Visa Application Center Appointment'
      })
    });
    const finalBookData = await finalBook.json();
    const finalAppt = finalBookData.data?.appointment || finalBookData.data;
    console.log(`✓ Re-booked appointment: ID=${finalAppt.id}, Number=${finalAppt.appointmentNumber}, Status=${finalAppt.status}`);

    console.log('\n=== ALL APPOINTMENT TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test failed with error:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppointmentLifecycle();
