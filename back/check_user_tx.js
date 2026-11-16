const prisma = require('./config/db');

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'bayramovilkin700@gmail.com' },
    include: {
      transactions: true,
      corporateInvoices: true
    }
  });
  console.log('User ID:', user.id);
  console.log('User transactions:', JSON.stringify(user.transactions, null, 2));
  console.log('Corporate Invoices:', JSON.stringify(user.corporateInvoices, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());

