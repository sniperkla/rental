import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGO_URI = 'mongodb://uoteru:AaBb1234%21@3.1.41.227:27020/jeawweaw?authSource=admin';

// Inline Schema definitions for independent execution
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: 'admin', enum: ['admin', 'staff'] }
}, { timestamps: true });

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  idNumber: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  email: String,
  address: String,
  status: { type: String, default: 'active', enum: ['active', 'suspended', 'blacklisted'] },
  notes: String
}, { timestamps: true });

const DeviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  serialNumber: { type: String, required: true, unique: true },
  imei: String,
  platform: { type: String, required: true, enum: ['android', 'ios'] },
  status: { type: String, default: 'available', enum: ['available', 'rented', 'locked', 'maintenance'] },
  color: String,
  storageGB: Number,
  dailyRate: Number,
  monthlyRate: Number,
  androidEnterpriseDeviceId: String,
  androidEnterpriseName: String,
  appleMdmUdid: String,
  applePushToken: String,
  notes: String,
  restrictions: {
    cameraDisabled: { type: Boolean, default: false },
    usbFileTransferDisabled: { type: Boolean, default: false },
    installAppsDisabled: { type: Boolean, default: false },
    outgoingCallsDisabled: { type: Boolean, default: false },
  },
  lastSeen: { type: Date, default: Date.now },
  screenTimeLocked: { type: Boolean, default: false }
}, { timestamps: true });

const RentalSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  billingCycle: { type: String, required: true, enum: ['daily', 'monthly'] },
  rateAmount: { type: Number, required: true },
  status: { type: String, default: 'active', enum: ['active', 'completed', 'cancelled'] },
  notes: String
}, { timestamps: true });

const PaymentSchema = new mongoose.Schema({
  rental: { type: mongoose.Schema.Types.ObjectId, ref: 'Rental', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidDate: Date,
  status: { type: String, default: 'pending', enum: ['pending', 'paid', 'overdue'] },
  periodStart: Date,
  periodEnd: Date,
  notes: String
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Customer = mongoose.model('Customer', CustomerSchema);
const Device = mongoose.model('Device', DeviceSchema);
const Rental = mongoose.model('Rental', RentalSchema);
const Payment = mongoose.model('Payment', PaymentSchema);

async function run() {
  console.log('🌱 Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  console.log('🧹 Clearing old database entries...');
  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Device.deleteMany({}),
    Rental.deleteMany({}),
    Payment.deleteMany({})
  ]);
  console.log('✨ Old data cleared.');

  console.log('👤 Seeding default admin user...');
  const hashedPassword = await bcrypt.hash('yourpassword', 10);
  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@rentcontrol.com',
    password: hashedPassword,
    role: 'admin'
  });
  console.log(`✅ Admin created: ${admin.email} (password: yourpassword)`);

  console.log('👥 Seeding customers...');
  const customerSomchai = await Customer.create({
    name: 'Somchai Jaidee (สมชาย ใจดี)',
    idNumber: '1100101111111',
    phone: '0812345678',
    email: 'somchai@gmail.com',
    address: '123/45 Sukhumvit Rd, Bangkok',
    status: 'active',
    notes: 'Premium customer, pays on time.'
  });

  const customerSomsri = await Customer.create({
    name: 'Somsri Rakdee (สมศรี รักดี)',
    idNumber: '1100202222222',
    phone: '0823456789',
    email: 'somsri@hotmail.com',
    address: '78 Phahonyothin Rd, Bangkok',
    status: 'active'
  });

  const customerWichai = await Customer.create({
    name: 'Wichai Mongkol (วิชัย มงคล)',
    idNumber: '1100303333333',
    phone: '0834567890',
    email: 'wichai@yahoo.com',
    address: '99/9 Ratchadapisek Rd, Bangkok',
    status: 'suspended',
    notes: 'Currently overdue on payment.'
  });

  console.log('📱 Seeding devices...');
  const devicePixel = await Device.create({
    name: 'Google Pixel 8 (Simulator Mock)',
    brand: 'Google',
    model: 'Pixel 8',
    serialNumber: 'SIM-AND-123',
    imei: '351234567890123',
    platform: 'android',
    status: 'rented',
    color: 'Obsidian Black',
    storageGB: 128,
    dailyRate: 100,
    monthlyRate: 2500,
    androidEnterpriseDeviceId: 'MOCK_DEV_123',
    androidEnterpriseName: 'enterprises/MOCK_ENT/devices/MOCK_DEV_123',
    notes: 'Mock Android device for development'
  });

  const deviceGalaxy = await Device.create({
    name: 'Samsung Galaxy S24 (Simulator Mock)',
    brand: 'Samsung',
    model: 'Galaxy S24',
    serialNumber: 'SIM-AND-999',
    imei: '359999999999999',
    platform: 'android',
    status: 'rented',
    color: 'Marble Gray',
    storageGB: 256,
    dailyRate: 120,
    monthlyRate: 2800,
    androidEnterpriseDeviceId: 'MOCK_DEV_999',
    androidEnterpriseName: 'enterprises/MOCK_ENT/devices/MOCK_DEV_999',
    notes: 'Mock Samsung device for testing'
  });

  const deviceIphone = await Device.create({
    name: 'iPhone 15 Pro Max (Simulator Mock)',
    brand: 'Apple',
    model: 'iPhone 15 Pro Max',
    serialNumber: 'SIM-IOS-888',
    imei: '358888888888888',
    platform: 'ios',
    status: 'available',
    color: 'Titanium Gray',
    storageGB: 512,
    dailyRate: 200,
    monthlyRate: 4500,
    appleMdmUdid: 'MOCK-UDID-888',
    applePushToken: 'MOCK-TOKEN-888',
    notes: 'Mock iOS device for testing'
  });

  const deviceRedmi = await Device.create({
    name: 'Redmi Note 13 (Simulator Mock)',
    brand: 'Xiaomi',
    model: 'Redmi Note 13',
    serialNumber: 'SIM-AND-777',
    imei: '357777777777777',
    platform: 'android',
    status: 'locked',
    color: 'Midnight Blue',
    storageGB: 128,
    dailyRate: 60,
    monthlyRate: 1500,
    androidEnterpriseDeviceId: 'MOCK_DEV_777',
    androidEnterpriseName: 'enterprises/MOCK_ENT/devices/MOCK_DEV_777',
    notes: 'Locked device due to overdue payment'
  });

  console.log('📋 Seeding active rentals...');
  // Rental 1: Somchai rents Pixel 8
  const rentalSomchai = await Rental.create({
    customer: customerSomchai._id,
    device: devicePixel._id,
    startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    billingCycle: 'monthly',
    rateAmount: 2500,
    status: 'active'
  });

  // Rental 2: Somsri rents Galaxy S24
  const rentalSomsri = await Rental.create({
    customer: customerSomsri._id,
    device: deviceGalaxy._id,
    startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    billingCycle: 'daily',
    rateAmount: 100,
    status: 'active'
  });

  // Rental 3: Wichai rented Redmi Note 13 (Overdue & Locked)
  const rentalWichai = await Rental.create({
    customer: customerWichai._id,
    device: deviceRedmi._id,
    startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
    billingCycle: 'monthly',
    rateAmount: 1500,
    status: 'active'
  });

  console.log('💳 Seeding payments...');
  // Payments for Somchai
  // Month 1: Paid
  await Payment.create({
    rental: rentalSomchai._id,
    customer: customerSomchai._id,
    device: devicePixel._id,
    amount: 2500,
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Due 10 days ago
    paidDate: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), // Paid 11 days ago
    status: 'paid',
    periodStart: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    periodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });
  // Month 2: Pending
  await Payment.create({
    rental: rentalSomchai._id,
    customer: customerSomchai._id,
    device: devicePixel._id,
    amount: 2500,
    dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // Due in 20 days
    status: 'pending',
    periodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    periodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
  });

  // Payments for Somsri (daily)
  for (let i = 0; i < 3; i++) {
    const daysAgo = 3 - i;
    const isPaid = i < 2;
    await Payment.create({
      rental: rentalSomsri._id,
      customer: customerSomsri._id,
      device: deviceGalaxy._id,
      amount: 100,
      dueDate: new Date(Date.now() - (daysAgo - 1) * 24 * 60 * 60 * 1000),
      paidDate: isPaid ? new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) : undefined,
      status: isPaid ? 'paid' : 'pending',
      periodStart: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      periodEnd: new Date(Date.now() - (daysAgo - 1) * 24 * 60 * 60 * 1000)
    });
  }

  // Payments for Wichai (Overdue & Locked)
  await Payment.create({
    rental: rentalWichai._id,
    customer: customerWichai._id,
    device: deviceRedmi._id,
    amount: 1500,
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Due 5 days ago (Overdue past 3 days grace period)
    status: 'overdue',
    periodStart: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
    periodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    notes: 'Automatic payment warning issued. Device locked.'
  });

  console.log('🎉 Seeding completed successfully!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
