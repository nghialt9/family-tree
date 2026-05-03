export function validateSignParams(params: {
  resourceType?: string;
  personId?: string;
  relationshipId?: string;
  albumId?: string;
}): string | null {
  if (!params.resourceType) return 'resourceType is required';
  const count = [params.personId, params.relationshipId, params.albumId].filter(v => v !== undefined && v !== '').length;
  if (count !== 1) {
    return 'Exactly one of personId, relationshipId, or albumId is required';
  }
  return null;
}
