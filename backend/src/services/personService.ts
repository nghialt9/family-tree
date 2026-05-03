import { Gender, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

export interface CreatePersonInput {
  fullName: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  phone?: string;
  address?: string;
  hometown?: string;
  homeLat?: number | null;
  homeLng?: number | null;
  currentLat?: number | null;
  currentLng?: number | null;
  bio?: string;
  email?: string;
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
      const phone = personData.phone as string;
      // Remove any token already linked to this person with a different phone
      await tx.accessToken.deleteMany({ where: { personId: person.id, NOT: { phone } } });
      const passwordHash = (grantRole === 'admin' || grantRole === 'editor') && grantPassword
        ? await bcrypt.hash(grantPassword, 12)
        : null;
      await tx.accessToken.upsert({
        where: { phone },
        create: { phone, role: grantRole, passwordHash, personId: person.id },
        update: { role: grantRole, ...(passwordHash ? { passwordHash } : {}), personId: person.id },
      });
    } else if (grantAccess === false && personData.phone) {
      // Admin explicitly unchecked grantAccess — revoke token for this person
      await tx.accessToken.deleteMany({ where: { personId: person.id } });
    }

    return person;
  });
}

export async function updatePerson(id: string, input: UpdatePersonInput & Record<string, unknown>) {
  const { grantAccess, grantRole, grantPassword, fatherId: _f, motherId: _m, spouseId: _s, ...personData } = input;

  const coordClear: Record<string, null> = {};
  if ('address' in personData && !personData.address) {
    coordClear.currentLat = null;
    coordClear.currentLng = null;
  }
  if ('hometown' in personData && !personData.hometown) {
    coordClear.homeLat = null;
    coordClear.homeLng = null;
  }

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.update({
      where: { id },
      data: {
        ...personData,
        ...coordClear,
        ...('deathDate' in personData ? { isAlive: !personData.deathDate } : {}),
        ...('birthDate' in personData ? { birthDate: personData.birthDate ? new Date(personData.birthDate as string) : null } : {}),
        ...('deathDate' in personData ? { deathDate: personData.deathDate ? new Date(personData.deathDate as string) : null } : {}),
      },
    });

    if (grantAccess && personData.phone && grantRole) {
      const phone = personData.phone as string;
      // Remove any token already linked to this person with a different phone
      await tx.accessToken.deleteMany({ where: { personId: person.id, NOT: { phone } } });
      const passwordHash = (grantRole === 'admin' || grantRole === 'editor') && grantPassword
        ? await bcrypt.hash(grantPassword, 12)
        : null;
      await tx.accessToken.upsert({
        where: { phone },
        create: { phone, role: grantRole, passwordHash, personId: person.id },
        update: { role: grantRole, ...(passwordHash ? { passwordHash } : {}), personId: person.id },
      });
    } else if (grantAccess === false && personData.phone) {
      // Admin explicitly unchecked grantAccess — revoke token for this person
      await tx.accessToken.deleteMany({ where: { personId: person.id } });
    }

    return person;
  });
}
