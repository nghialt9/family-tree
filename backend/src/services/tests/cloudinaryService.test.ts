import { v2 as cloudinary } from 'cloudinary';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: {
      api_sign_request: jest.fn(),
    },
    uploader: {
      destroy: jest.fn(),
    },
  },
}));

import { generateSignature, deleteMedia } from '../cloudinaryService';

const mockedApiSignRequest = jest.mocked(cloudinary.utils.api_sign_request);
const mockedDestroy = jest.mocked(cloudinary.uploader.destroy);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.CLOUDINARY_API_KEY = 'test-api-key';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
});

describe('generateSignature', () => {
  it('returns signature and credentials for a given folder', () => {
    mockedApiSignRequest.mockReturnValue('mock-sig');

    const result = generateSignature({ folder: 'family-tree/persons/abc', resourceType: 'image' });

    expect(mockedApiSignRequest).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'family-tree/persons/abc' }),
      'test-secret'
    );
    expect(result).toEqual({
      signature: 'mock-sig',
      timestamp: expect.any(Number),
      apiKey: 'test-api-key',
      cloudName: 'test-cloud',
      folder: 'family-tree/persons/abc',
    });
  });

  it('includes timestamp in params sent to api_sign_request', () => {
    mockedApiSignRequest.mockReturnValue('sig');
    const before = Math.round(Date.now() / 1000);

    const result = generateSignature({ folder: 'family-tree/persons/xyz', resourceType: 'video' });

    const after = Math.round(Date.now() / 1000);
    const [[paramsArg]] = mockedApiSignRequest.mock.calls as any;
    expect(paramsArg.timestamp).toBeGreaterThanOrEqual(before);
    expect(paramsArg.timestamp).toBeLessThanOrEqual(after);
    expect(result.timestamp).toBe(paramsArg.timestamp);
  });
});

describe('deleteMedia', () => {
  it('calls destroy with resource_type image for IMAGE', async () => {
    mockedDestroy.mockResolvedValue({ result: 'ok' } as any);

    await deleteMedia('family-tree/persons/abc/photo', 'IMAGE');

    expect(mockedDestroy).toHaveBeenCalledWith(
      'family-tree/persons/abc/photo',
      { resource_type: 'image' }
    );
  });

  it('calls destroy with resource_type video for VIDEO', async () => {
    mockedDestroy.mockResolvedValue({ result: 'ok' } as any);

    await deleteMedia('family-tree/persons/abc/clip', 'VIDEO');

    expect(mockedDestroy).toHaveBeenCalledWith(
      'family-tree/persons/abc/clip',
      { resource_type: 'video' }
    );
  });

  it('calls destroy with resource_type raw for RAW', async () => {
    mockedDestroy.mockResolvedValue({ result: 'ok' } as any);

    await deleteMedia('family-tree/persons/abc/doc', 'RAW');

    expect(mockedDestroy).toHaveBeenCalledWith(
      'family-tree/persons/abc/doc',
      { resource_type: 'raw' }
    );
  });
});
