export function validateSignParams(params: {
  resourceType?: string;
  personId?: string;
  relationshipId?: string;
}): string | null {
  if (!params.resourceType) return 'resourceType is required';
  const hasPersonId = !!params.personId;
  const hasRelationshipId = !!params.relationshipId;
  if (hasPersonId === hasRelationshipId) {
    return 'Exactly one of personId or relationshipId is required';
  }
  return null;
}
