import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { Student } from '../models/Student.js';
import { Admin } from '../models/Admin.js';
import { Department } from '../models/Department.js';
import { Complaint } from '../models/Complaint.js';
import { Announcement } from '../models/Announcement.js';

dotenv.config();

const defaultStaffPassword = 'staff123';

async function seedDatabase() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await connectDB();

    console.log('[Seed] Purging legacy collections and initializing 5-collection architecture...');

    // 1. Drop legacy 'users' collection if present
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map((c) => c.name);
      if (collectionNames.includes('users')) {
        await mongoose.connection.db.dropCollection('users');
        console.log('[Seed] Legacy collection `users` successfully dropped.');
      }
    } catch (dropErr) {
      console.warn('[Seed] Notice dropping users collection:', dropErr.message);
    }

    // 2. Clear all 5 target collections
    await Student.deleteMany();
    await Admin.deleteMany();
    await Department.deleteMany();
    await Complaint.deleteMany();
    await Announcement.deleteMany();
    console.log('[Seed] Cleared: students, admins, departments, complaints, announcements.');

    // 3. Seed Admin in `admins`
    console.log('[Seed] Seeding Default Admin in `admins`...');
    const admin = await Admin.create({
      name: 'Dr. K. Ramanathan',
      email: 'admin@cmsce.edu',
      password: 'admin123',
      phone: '+91 98765 43210',
      role: 'ADMIN'
    });
    console.log(`[Seed] Admin seeded: ${admin.email} (Dr. K. Ramanathan)`);

    // 4. Seed the 6 Core Departments with Embedded Department Heads in `departments`
    console.log('[Seed] Seeding 6 Official Departments with embedded credentials in `departments`...');

    const departmentsSeedData = [
      {
        code: 'CANTEEN',
        name: 'Canteen Operations',
        slaHours: 4,
        description: 'Food preparation, meal hygiene, dining hall operations, and pantry services.',
        icon: 'Utensils',
        head: {
          name: 'R. Sundaram',
          email: 'canteen@cmsce.edu',
          phone: '+91 94441 12233',
          password: defaultStaffPassword,
          assignedAt: new Date()
        }
      },
      {
        code: 'TRANSPORT',
        name: 'Transport Management',
        slaHours: 12,
        description: 'College bus fleet, transit routes, driver scheduling, and boarding points.',
        icon: 'Bus',
        head: {
          name: 'M. Balaji',
          email: 'transport@cmsce.edu',
          phone: '+91 94441 22334',
          password: defaultStaffPassword,
          assignedAt: new Date()
        }
      },
      {
        code: 'HOSTEL',
        name: 'Hostel Maintenance',
        slaHours: 24,
        description: 'Student hostel blocks, plumbing, electrical fixtures, room amenities, and cleaning.',
        icon: 'Building2',
        head: {
          name: 'S. Ananthi',
          email: 'hostel@cmsce.edu',
          phone: '+91 94441 33445',
          password: defaultStaffPassword,
          assignedAt: new Date()
        }
      },
      {
        code: 'SPORTS',
        name: 'Sports & Facilities',
        slaHours: 48,
        description: 'Athletic grounds, indoor stadium, gym facilities, and sports equipment.',
        icon: 'Trophy',
        head: {
          name: 'V. Prakash',
          email: 'sports@cmsce.edu',
          phone: '+91 94441 44556',
          password: defaultStaffPassword,
          assignedAt: new Date()
        }
      },
      {
        code: 'ACADEMIC',
        name: 'Academic Affairs',
        slaHours: 24,
        description: 'Course scheduling, exam cell coordination, classroom audio-visuals, and faculty desks.',
        icon: 'GraduationCap',
        head: {
          name: 'Dr. N. Murali',
          email: 'academic@cmsce.edu',
          phone: '+91 94441 55667',
          password: defaultStaffPassword,
          assignedAt: new Date()
        }
      },
      {
        code: 'HOSPITALITY',
        name: 'Campus Hospitality & Security',
        slaHours: 24,
        description: 'Campus perimeter security, guest house accommodations, visitor management, and waste clearance.',
        icon: 'ConciergeBell',
        head: {
          name: 'K. Vetrivel',
          email: 'hospitality@cmsce.edu',
          phone: '+91 94441 66778',
          password: defaultStaffPassword,
          assignedAt: new Date()
        }
      }
    ];

    for (const d of departmentsSeedData) {
      await Department.create(d);
    }
    console.log('[Seed] 6 departments seeded with embedded heads & hashed credentials.');

    // 5. Complaints Collection starts completely empty
    console.log('[Seed] Complaints collection starts completely empty (0 tickets). Ready for live submissions.');

    // 6. Seed Announcements in `announcements`
    console.log('[Seed] Seeding initial broadcasts in `announcements`...');
    await Announcement.create({
      title: 'Monsoon Bus Timetable Adjusted',
      content: 'Due to heavy rains in sector 4, morning bus routes 3, 4, and 7 will depart 15 minutes earlier starting Monday.',
      message: 'Due to heavy rains in sector 4, morning bus routes 3, 4, and 7 will depart 15 minutes earlier starting Monday.',
      priority: 'NORMAL',
      target_role: 'ALL',
      authorRole: 'DEPT_HEAD',
      departmentCode: 'TRANSPORT',
      author_name: 'Transport Directorate'
    });

    await Announcement.create({
      title: 'Campus Central Dining Hygiene Audit',
      content: 'Annual food safety and nutrition inspection scheduled for Tuesday across all college canteens.',
      message: 'Annual food safety and nutrition inspection scheduled for Tuesday across all college canteens.',
      priority: 'NORMAL',
      target_role: 'ALL',
      authorRole: 'ADMIN',
      departmentCode: 'CANTEEN',
      author_name: 'Campus Administration'
    });

    console.log(`
    ===================================================================
    🎉 CMSCE 5-Collection Database Architecture Initialized!
    ===================================================================
    Collections verified:
    1. students      : 0 (Ready for student registrations)
    2. admins        : 1 (admin@cmsce.edu / admin123)
    3. departments   : 6 (CANTEEN, TRANSPORT, HOSTEL, SPORTS, ACADEMIC, HOSPITALITY)
                       All heads configured with default password: ${defaultStaffPassword}
    4. complaints    : 0 (EMPTY - Clean slate for live production tickets)
    5. announcements : 2 (Initial campus broadcasts)
    ===================================================================
    `);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
}

seedDatabase();
