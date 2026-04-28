import { PrismaClient, Gender, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface CreatePersonInput {
  fullName: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  phone?: string;
  address?: string;
  bio?: string;
  generation: number;
  grantAccess?: boolean;
  grantRole?: Role;
  grantPassword?: string;
}

export type UpdatePersonInput = Partial<CreatePersonInput>;

export async function createPerson(input: CreatePersonInput & Record<string, unknown>) {
  const { grantAccess, grantRole, grantPassword, fatherId: _f, motherId: _m, spouseId: _s, ...personData } = input;

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        ...personData,
        isAlive: !personData.deathDate,
        birthDate: personData.birthDate ? new Date(personData.birthDate) : undefined,
        deathDate: personData.deathDate ? new Date(personData.deathDate) : undefined,
      },
    });

    if (grantAccess && personData.phone && grantRole) {
      const passwordHash = grantRole === 'admin' && grantPassword
        ? await bcrypt.hash(grantPassword, 12)
        : undefined;
      await tx.accessToken.upsert({
        where: { phone: personData.phone },
        create: { phone: personData.phone, role: grantRole, passwordHash, personId: person.id },
        update: { role: grantRole, passwordHash, personId: person.id },
      });
    }

    return person;
  });
}

export async function updatePerson(id: string, input: UpdatePersonInput & Record<string, unknown>) {
  const { grantAccess, grantRole, grantPassword, fatherId: _f, motherId: _m, spouseId: _s, ...personData } = input;

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.update({
      where: { id },
      data: {
        ...personData,
        isAlive: personData.deathDate ? false : undefined,
        birthDate: personData.birthDate ? new Date(personData.birthDate) : undefined,
        deathDate: personData.deathDate ? new Date(personData.deathDate) : undefined,
      },
    });

    if (grantAccess && personData.phone && grantRole) {
      const passwordHash = grantRole === 'admin' && grantPassword
        ? await bcrypt.hash(grantPassword, 12)
        : undefined;
      await tx.accessToken.upsert({
        where: { phone: personData.phone },
        create: { phone: personData.phone, role: grantRole, passwordHash, personId: person.id },
        update: { role: grantRole, ...(passwordHash ? { passwordHash } : {}), personId: person.id },
      });
    }

    return person;
  });
}
