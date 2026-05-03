import { validateSignParams } from '../../routes/mediaSignValidation';

describe('validateSignParams', () => {
  it('returns error when both personId and relationshipId provided', () => {
    expect(validateSignParams({ resourceType: 'image', personId: 'a', relationshipId: 'b' })).toBe(
      'Exactly one of personId, relationshipId, or albumId is required'
    );
  });

  it('returns error when resourceType missing', () => {
    expect(validateSignParams({ personId: 'a' })).toBe('resourceType is required');
  });

  it('returns null when personId provided', () => {
    expect(validateSignParams({ resourceType: 'image', personId: 'abc' })).toBeNull();
  });

  it('returns null when relationshipId provided', () => {
    expect(validateSignParams({ resourceType: 'video', relationshipId: 'xyz' })).toBeNull();
  });

  it('returns error when albumId and personId both provided', () => {
    expect(validateSignParams({ resourceType: 'image', personId: 'a', albumId: 'b' })).toBe(
      'Exactly one of personId, relationshipId, or albumId is required'
    );
  });

  it('returns null when albumId provided', () => {
    expect(validateSignParams({ resourceType: 'image', albumId: 'xyz' })).toBeNull();
  });

  it('returns error when none of personId/relationshipId/albumId provided', () => {
    expect(validateSignParams({ resourceType: 'image' })).toBe(
      'Exactly one of personId, relationshipId, or albumId is required'
    );
  });
});
