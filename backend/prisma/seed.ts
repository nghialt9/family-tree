import { PrismaClient, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  await prisma.accessToken.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.person.deleteMany();
  console.log('Seeding Lâm family data...');

  // Generation 1
  const thui = await prisma.person.create({
    data: { fullName: 'Lâm Văn Thúi', nickname: 'Thúi', gender: 'male', generation: 1, isAlive: false },
  });

  // Generation 2
  const [tieu, lieu, lang, mang, non, nuoc, dep, pha, qua] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Tiếu', nickname: 'Tiếu', gender: 'female', generation: 2 } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Liếu', nickname: 'Liếu', gender: 'male', generation: 2, phone: '0985762894' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Lăng', nickname: 'Lăng', gender: 'male', generation: 2, phone: '0981812961' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Măng', nickname: 'Măng', gender: 'male', generation: 2, phone: '0342746696' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Non', nickname: 'Non', gender: 'male', generation: 2, phone: '0368914214' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Nước', nickname: 'Nước', gender: 'female', generation: 2, isAlive: false } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Đẹp', nickname: 'Đẹp', gender: 'female', generation: 2 } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Pha', nickname: 'Pha', gender: 'male', generation: 2, phone: '0342981654' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Qua', nickname: 'Qua', gender: 'male', generation: 2 } }),
  ]);

  // Gen 1 → Gen 2 parent-child
  for (const child of [tieu, lieu, lang, mang, non, nuoc, dep, pha, qua]) {
    await prisma.relationship.create({ data: { personAId: thui.id, personBId: child.id, type: 'parent_child' } });
  }

  // Generation 3 — children of Tiếu
  const [binh, minh, dan, ho] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Bình', nickname: 'Bình', gender: 'male', generation: 3, phone: '0367327153' } }),
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Minh', nickname: 'Minh', gender: 'male', generation: 3 } }),
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Dân', nickname: 'Dân', gender: 'male', generation: 3 } }),
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Hồ', nickname: 'Hồ', gender: 'male', generation: 3 } }),
  ]);
  for (const c of [binh, minh, dan, ho]) {
    await prisma.relationship.create({ data: { personAId: tieu.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Liếu
  const [hung, hien, hai, hau] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Hùng', nickname: 'Hùng', gender: 'male', generation: 3, phone: '0832708189' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Hiền', nickname: 'Hiền', gender: 'female', generation: 3, phone: '0386804319' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Hài', nickname: 'Hài', gender: 'male', generation: 3, isAlive: false } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Hậu', nickname: 'Hậu', gender: 'male', generation: 3, phone: '0366728486' } }),
  ]);
  for (const c of [hung, hien, hai, hau]) {
    await prisma.relationship.create({ data: { personAId: lieu.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Lăng
  const [nhanh, nhan, nghia, phuong] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Nhanh', nickname: 'Nhanh', gender: 'male', generation: 3 } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Nhân', nickname: 'Nhân', gender: 'male', generation: 3, phone: '0939309402' } }),
    prisma.person.create({ data: { fullName: 'Lâm Trọng Nghĩa', nickname: 'Nghĩa', gender: 'male', generation: 3, phone: '0972737308' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Phương', nickname: 'Phương', gender: 'female', generation: 3, phone: '0983948081' } }),
  ]);
  for (const c of [nhanh, nhan, nghia, phuong]) {
    await prisma.relationship.create({ data: { personAId: lang.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Măng
  const [hang, phong] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Hằng', nickname: 'Hằng', gender: 'female', generation: 3 } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Phong', nickname: 'Phong', gender: 'male', generation: 3, phone: '0788856876' } }),
  ]);
  for (const c of [hang, phong]) {
    await prisma.relationship.create({ data: { personAId: mang.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Non
  const [chi, chi1] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Chi', nickname: 'Chi', gender: 'female', generation: 3, phone: '0372576462' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Chí', nickname: 'Chí', gender: 'male', generation: 3, phone: '0328739463' } }),
  ]);
  for (const c of [chi, chi1]) {
    await prisma.relationship.create({ data: { personAId: non.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Đẹp
  const [tu, dung] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Tú', nickname: 'Tú', gender: 'male', generation: 3, phone: '0352980551' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Dung', nickname: 'Dung', gender: 'female', generation: 3, phone: '0392431181' } }),
  ]);
  for (const c of [tu, dung]) {
    await prisma.relationship.create({ data: { personAId: dep.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Pha
  const [luan, nhi] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Luân', nickname: 'Luân', gender: 'male', generation: 3 } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Nhi', nickname: 'Nhi', gender: 'female', generation: 3 } }),
  ]);
  for (const c of [luan, nhi]) {
    await prisma.relationship.create({ data: { personAId: pha.id, personBId: c.id, type: 'parent_child' } });
  }

  // children of Qua
  const [phuong1, ly] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Phượng', nickname: 'Phượng', gender: 'female', generation: 3, phone: '0337625398' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Ly', nickname: 'Ly', gender: 'female', generation: 3 } }),
  ]);
  for (const c of [phuong1, ly]) {
    await prisma.relationship.create({ data: { personAId: qua.id, personBId: c.id, type: 'parent_child' } });
  }

  // Generation 4
  type Gen4Item = { parent: { id: string }; data: Parameters<typeof prisma.person.create>[0]['data'] };
  const gen4Items: Gen4Item[] = [
    { parent: binh,  data: { fullName: 'Con Bình 1',           gender: 'female' as Gender, generation: 4 } },
    { parent: binh,  data: { fullName: 'Con Bình 2',           gender: 'female' as Gender, generation: 4 } },
    { parent: binh,  data: { fullName: 'Con Bình 3',           gender: 'male'   as Gender, generation: 4 } },
    { parent: dan,   data: { fullName: 'Con Dân 1',            gender: 'female' as Gender, generation: 4 } },
    { parent: hung,  data: { fullName: 'Lâm Thị Thi',   nickname: 'Thi',   gender: 'female' as Gender, generation: 4 } },
    { parent: hung,  data: { fullName: 'Lâm Văn Tài',   nickname: 'Tài',   gender: 'male'   as Gender, generation: 4 } },
    { parent: hien,  data: { fullName: 'Lâm Thị Thảo',  nickname: 'Thảo',  gender: 'female' as Gender, generation: 4 } },
    { parent: hien,  data: { fullName: 'Lâm Thị Duyên', nickname: 'Duyên', gender: 'female' as Gender, generation: 4 } },
    { parent: hien,  data: { fullName: 'Lâm Thị Duyên 2',                  gender: 'female' as Gender, generation: 4 } },
    { parent: hai,   data: { fullName: 'Con Hài 1',            gender: 'male'   as Gender, generation: 4 } },
    { parent: hai,   data: { fullName: 'Lâm Văn Phú',  nickname: 'Phú',   gender: 'male'   as Gender, generation: 4 } },
    { parent: nhanh, data: { fullName: 'Lâm Văn Trí',  nickname: 'Trí',   gender: 'male'   as Gender, generation: 4, phone: '0984783471' } },
    { parent: nhan,  data: { fullName: 'Lâm Thị Ngọc', nickname: 'Ngọc',  gender: 'female' as Gender, generation: 4 } },
    { parent: hang,  data: { fullName: 'Lâm Văn Thuận',nickname: 'Thuận', gender: 'male'   as Gender, generation: 4, phone: '0372824019' } },
    { parent: hang,  data: { fullName: 'Lâm Văn Nguyên',nickname:'Nguyên',gender: 'male'   as Gender, generation: 4 } },
    { parent: tu,    data: { fullName: 'Lâm Thị Ngân', nickname: 'Ngân',  gender: 'female' as Gender, generation: 4 } },
  ];

  for (const { parent, data } of gen4Items) {
    const child = await prisma.person.create({ data });
    await prisma.relationship.create({ data: { personAId: parent.id, personBId: child.id, type: 'parent_child' } });
  }

  // Admin access token for Nghĩa
  await prisma.accessToken.create({
    data: {
      phone: '0972737308',
      role: 'admin',
      label: 'Nghĩa (Admin)',
      passwordHash: await bcrypt.hash('familytree2024', 12),
      personId: nghia.id,
    },
  });

  console.log(`Seed complete! Created persons and relationships.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
